import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

// Create logger instance
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ipecity-pulse' },
  transports: [
    // Write all logs to console with appropriate formatting
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Custom JSON stringify that handles BigInt
          const metaString = Object.keys(meta).length
            ? JSON.stringify(meta, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value, 2)
            : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        })
      )
    }),
  ],
});

// In production, also log to file
if (isProduction) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
}

// Helper functions for common log patterns
export const logUtils = {
  // Log API requests
  logApiRequest: (method: string, path: string, userId?: number, meta?: any) => {
    logger.info('API Request', { 
      method, 
      path, 
      userId: userId || 'anonymous',
      ...meta 
    });
  },

  // Log security events
  logSecurityEvent: (event: string, userId?: number, details?: any) => {
    logger.warn('Security Event', { 
      event, 
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString(),
      ...details 
    });
  },

  // Log authentication events
  logAuthEvent: (event: string, userId?: number, success: boolean = true, details?: any) => {
    const level = success ? 'info' : 'warn';
    logger.log(level, 'Auth Event', { 
      event, 
      userId: userId || 'anonymous',
      success,
      ...details 
    });
  },

  // Log database operations (without sensitive data)
  logDbOperation: (operation: string, table?: string, success: boolean = true, meta?: any) => {
    const level = success ? 'debug' : 'error';
    logger.log(level, 'Database Operation', { 
      operation,
      table,
      success,
      ...meta 
    });
  },

  // Log external API calls
  logExternalApi: (service: string, endpoint: string, success: boolean = true, responseTime?: number) => {
    const level = success ? 'debug' : 'warn';
    logger.log(level, 'External API Call', { 
      service,
      endpoint,
      success,
      responseTime: responseTime ? `${responseTime}ms` : undefined
    });
  },

  // Sanitize sensitive data from logs
  sanitize: (data: any): any => {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'mnemonic', 'private'];
    const sanitized = { ...data };
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = logUtils.sanitize(value);
      }
    }
    
    return sanitized;
  }
};

export default logger;