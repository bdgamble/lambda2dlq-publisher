# lambda2dlq-publisher

Module that sends a lambda event, along with error details and lambda context info to the provided deadletter queue url via AWS SQS.

# Usage

## new Publisher(dlqUrl, options)
Constructor for the class.
- **dlqUrl** - { String, required } - valid url to the deadletter queue you wish to send a message to.
- **options** - { Object, optional } - an object to provide configuration options.
  - **logger** - { Object/Function, optional } - a valid logger (minimum must have info and error functions), or a function that takes the lambda context and returns a valid logger. If no logger is provided, the default callback will not log any information.

```javascript
const Publisher = require('lambda2dlq-publisher');
const logger = require('./path/to/your/logger');

const dlqUrl = 'https://sqs.us-east-1.amazonaws.com/112233445566/test-deadletter'

// no logger
const publisher = new Publisher(dlqUrl);

// passed logger
const publisher2 = new Publisher(dlqUrl, { logger });

// logger from context (if you've used a module like lambda-handler-as-promised)
const publisher3 = new Publisher(dlqUrl, { logger: (context) => context.log });
```

## publish(event, context, err, cb)
Method to publish the event, error and context info to the configured deadletter queue url.
- **event** - { Object, required } - the lambda event that failed
- **context** - { Object, required } - the lambda context
- **err** - { Object, required } - the error that the lambda event failed with
- **cb** - { Function, optional } - takes params err and result and is called on success or failure of sending the message to the deadletter queue. By default returns a promise that rejects on error or resolves with the result from sending the message, with some basic logging.

```javascript
const Publisher = require('lambda2dlq-publisher');

const publisher = new Publisher(dlqUrl);

// lambda handler
module.exports.handler = function(event, context, cb) {
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (err) {
    console.error('Failed to parse event data, not valid JSON.');
    publisher.publish(event, context, err, cb);
  }

  cb(null, data);
};
```
