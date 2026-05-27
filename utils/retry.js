// =====================================================
// Retry and Backoff Utility
// =====================================================
// Exponential backoff retry logic for API calls
// =====================================================

class RetryManager {
    constructor(config = {}) {
        this.maxRetries = config.maxRetries || 3;
        this.initialDelay = config.initialDelay || 1000; // 1 second
        this.maxDelay = config.maxDelay || 30000; // 30 seconds
        this.backoffMultiplier = config.backoffMultiplier || 2;
        this.retryableErrors = config.retryableErrors || [
            'ECONNREFUSED',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN',
            'timeout',
            'Request timeout'
        ];
        this.retryableStatusCodes = config.retryableStatusCodes || [
            408, // Request Timeout
            429, // Too Many Requests
            500, // Internal Server Error
            502, // Bad Gateway
            503, // Service Unavailable
            504  // Gateway Timeout
        ];
    }

    // Execute a function with retry logic
    async execute(fn, context = {}) {
        let lastError;
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            attempt++;

            try {
                const result = await fn();
                return result;
            } catch (error) {
                lastError = error;

                // Check if error is retryable
                if (!this.isRetryable(error)) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt > this.maxRetries) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = this.calculateDelay(attempt);

                console.warn(`Retry attempt ${attempt}/${this.maxRetries} after ${delay}ms - Error: ${error.message}`);

                // Wait before retry
                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    // Check if error is retryable
    isRetryable(error) {
        // Check error code/message
        const errorMessage = error.message || '';
        const errorCode = error.code || '';

        const isRetryableError = this.retryableErrors.some(
            retryableError => errorMessage.includes(retryableError) || errorCode.includes(retryableError)
        );

        // Check HTTP status code
        const isRetryableStatus = this.retryableStatusCodes.includes(error.statusCode || error.status);

        return isRetryableError || isRetryableStatus;
    }

    // Calculate delay with exponential backoff and jitter
    calculateDelay(attempt) {
        const exponentialDelay = this.initialDelay * Math.pow(this.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
        const delay = Math.min(exponentialDelay + jitter, this.maxDelay);
        return Math.floor(delay);
    }

    // Sleep for specified milliseconds
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Wrap fetch with retry logic
    async fetchWithRetry(url, options = {}, context = {}) {
        return this.execute(async () => {
            const response = await fetch(url, options);
            
            // Check if response is ok
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.statusCode = response.status;
                error.status = response.status;
                throw error;
            }

            return response;
        }, context);
    }

    // Wrap HTTP request with retry logic
    async httpRequestWithRetry(options, context = {}) {
        return this.execute(async () => {
            return new Promise((resolve, reject) => {
                const http = options.protocol === 'https:' ? require('https') : require('http');
                
                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                resolve(data);
                            }
                        } else {
                            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
                            error.statusCode = res.statusCode;
                            error.status = res.statusCode;
                            reject(error);
                        }
                    });
                });

                req.on('error', reject);
                req.setTimeout(options.timeout || 15000, () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                if (options.body) {
                    req.write(options.body);
                }
                req.end();
            });
        }, context);
    }

    // Circuit breaker pattern - prevent cascading failures
    createCircuitBreaker(threshold = 5, timeout = 60000) {
        let failures = 0;
        let lastFailureTime = 0;
        let state = 'closed'; // closed, open, half-open

        return {
            execute: async (fn) => {
                const now = Date.now();

                // Check if circuit should reset
                if (state === 'open' && now - lastFailureTime > timeout) {
                    state = 'half-open';
                    console.log('Circuit breaker: half-open state');
                }

                // Reject if circuit is open
                if (state === 'open') {
                    throw new Error('Circuit breaker is open');
                }

                try {
                    const result = await fn();
                    
                    // Reset on success
                    if (state === 'half-open') {
                        state = 'closed';
                        failures = 0;
                        console.log('Circuit breaker: closed state');
                    }
                    
                    return result;
                } catch (error) {
                    failures++;
                    lastFailureTime = now;

                    // Open circuit if threshold reached
                    if (failures >= threshold) {
                        state = 'open';
                        console.error(`Circuit breaker: open state after ${failures} failures`);
                    }

                    throw error;
                }
            },
            getState: () => state,
            getFailures: () => failures,
            reset: () => {
                failures = 0;
                state = 'closed';
                console.log('Circuit breaker: reset');
            }
        };
    }

    // Rate limiter - prevent too many requests
    createRateLimiter(maxRequests, windowMs) {
        let requests = [];
        let blocked = false;
        let blockUntil = 0;

        return {
            execute: async (fn) => {
                const now = Date.now();

                // Check if blocked
                if (blocked && now < blockUntil) {
                    const waitTime = blockUntil - now;
                    throw new Error(`Rate limited: wait ${waitTime}ms`);
                }

                // Reset block if time passed
                if (blocked && now >= blockUntil) {
                    blocked = false;
                    requests = [];
                }

                // Clean old requests
                requests = requests.filter(time => now - time < windowMs);

                // Check if limit exceeded
                if (requests.length >= maxRequests) {
                    blocked = true;
                    blockUntil = now + windowMs;
                    throw new Error(`Rate limit exceeded: ${maxRequests} requests per ${windowMs}ms`);
                }

                // Add current request
                requests.push(now);

                // Execute function
                return await fn();
            },
            getRequestCount: () => requests.length,
            reset: () => {
                requests = [];
                blocked = false;
            }
        };
    }
}

// Export singleton instance
const retryManager = new RetryManager();

module.exports = {
    RetryManager,
    retryManager
};
