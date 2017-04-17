'use strict';

const AWS = require('aws-sdk');

module.exports = class DLQPublisher {
  constructor(dlqUrl, options) {
    if (!dlqUrl) {
      throw new Error('dlqUrl is a required constructor parameter.');
    }
    options = options || {};

    this._client = new AWS.SQS();
    this.dlqUrl = dlqUrl;
    this.logger = options.logger;
  }

  publish(event, context, err, cb) {
    if (!event || !context || !err) {
      throw new Error('event, context, and err are required parameters.');
    }

    let logger = this.logger;
    if (typeof logger === 'function') {
      logger = logger(context);
    }

    cb = cb || function(err, result) {
      return new Promise((resolve, reject) => {
        if (err) {
          logger && logger.error({ err }, 'failed to publish event to DLQ');
          err._logged = true;
          reject(err);
          return;
        }
        logger && logger.info({ result }, 'event published to DLQ')
        resolve(result);
      });
    }

    const params = {
      MessageBody: JSON.stringify(event),
      QueueUrl: this.dlqUrl,
      MessageAttributes: {
        'err.message': {
          DataType: 'String',
          StringValue: err.message
        },
        'err.stack': {
          DataType: 'String',
          StringValue: err.stack
        },
        'context.awsRequestId': {
          DataType: 'String',
          StringValue: context.awsRequestId
        }
      }
    };

    return this._client
      .sendMessage(params)
      .promise()
      .then(dlqResult => cb(null, dlqResult))
      .catch(cb);
  }
}
