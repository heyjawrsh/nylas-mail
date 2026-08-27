const stream = require('stream');

class StringStream extends stream.Writable {
  constructor() {
    super();
    this.chunks = [];
  }

  _write(chunk, enc, next) {
    this.chunks.push(chunk);
    next();
  }

  toString() {
    return Buffer.concat(this.chunks).toString();
  }

  reset() {
    this.chunks = [];
  }
}

const testStream = {
  level: 'info',
  stream: new StringStream(),
}

/**
 * @returns {{level: string, stream?: object, transport?: object}}
 * pino destination description for the given environment.
 */
const getLogDestination = (name, env) => {
  switch (env) {
    case 'development': {
      return {
        level: 'debug',
        transport: {
          targets: [
            {target: 'pino-pretty', level: 'error', options: {destination: 2}},
            {target: 'pino-pretty', level: 'debug', options: {destination: 1}},
          ],
        },
      }
    }
    case 'test': {
      return testStream
    }
    default: {
      return {
        level: 'info',
        stream: process.stdout,
      }
    }
  }
}

module.exports = {getLogDestination, testStream}
