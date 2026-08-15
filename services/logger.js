const util = require('util');

function formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = util.format(...args);
    return `[${timestamp}] [${level}] ${message}`;
}

const logger = {
    info: (...args) => console.log(formatMessage('INFO', args)),
    warn: (...args) => console.warn(formatMessage('WARN', args)),
    error: (...args) => console.error(formatMessage('ERROR', args)),
    fatal: (...args) => console.error(formatMessage('FATAL', args)),
    debug: (...args) => {
        if (process.env.DEBUG === 'true') {
            console.log(formatMessage('DEBUG', args));
        }
    }
};

module.exports = logger;
