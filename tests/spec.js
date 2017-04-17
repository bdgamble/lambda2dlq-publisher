'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

chai.use(chaiAsPromised);
const expect = chai.expect;

const Publisher = require('../');

function generateAWSPromise(value) {
  return {
    promise() {
      return Promise.resolve(typeof value === 'function' ? value() : value);
    }
  };
}

describe('lambda2dlq-publisher', () => {
  describe('constructor', () => {
    it('throws an error when no params provided', () => {
      return expect(() => new Publisher())
        .to.throw(Error, /dlqUrl is a required constructor parameter/);
    });

    it('throws an error when no dlqUrl provided', () => {
      return expect(() => new Publisher(null, { logger: console }))
        .to.throw(Error, /dlqUrl is a required constructor parameter/);
    });

    it('succeeds with a dlqUrl', () => {
      return expect(() => new Publisher('dlqUrl'))
        .to.not.throw(Error, /dlqUrl is a required constructor parameter/);
    });

    it('succeeds with a dlqUrl and logger', () => {
      return expect(() => new Publisher('dlqUrl', { logger: console }))
        .to.not.throw(Error, /dlqUrl is a required constructor parameter/);
    });

    it('succeeds with a dlqUrl and function that returns logger', () => {
      return expect(() => new Publisher('dlqUrl', { logger: () => console }))
        .to.not.throw(Error, /dlqUrl is a required constructor parameter/);
    });
  });

  describe('publish param validation', () => {
    [
      [{ data: 'testData' }, { awsRequestId: '11223344556677889900' }],
      [{ data: 'testData' }, undefined, new Error('Test Error')],
      [undefined, { awsRequestId: '11223344556677889900' }, new Error('Test Error')],
      [{ data: 'testData' }],
      [undefined, { awsRequestId: '11223344556677889900' }],
      [undefined, undefined, new Error('Test Error')],
      []
    ].forEach(test => {
      it('Fails with input: ' + JSON.stringify(test), () => {
        const dlqUrl = 'dlqUrl';
        const publisher = new Publisher(dlqUrl);
        return expect(() => publisher.publish.call(this, test))
          .to.throw(Error, /event, context, and err are required parameters/);
      })
    })
  })

  describe('publish with logger', () => {
    let publisher;
    const dlqUrl = 'dlqUrl';
    before(done => {
      publisher = new Publisher(dlqUrl, { logger: console });
      this.sandbox = sinon.sandbox.create();
      this.testContext = {
        awsRequestId: '00112233445566778899'
      };
      done();
    });

    beforeEach(done => {
      this.sendMessageMock = this.sandbox.mock(publisher._client).expects('sendMessage');
      done();
    });

    afterEach(done => {
      this.sandbox.restore();
      this.sendMessageMock.verify();
      done();
    });

    const testEvent = { data: 'test data' };
    const testError = new Error('horrible error');
    const testCBError = new Error('testCB Error');
    const testCBData= { data: 'testCB data'};
    function testCB(err, result) {
      return new Promise((resolve, reject) => {
        if (err) {
          console.error('Ignoring error: ', err);
          reject(testCBError);
          return;
        }
        console.info('Ignoring result: ', result);
        resolve(testCBData);
      });
    }

    [
      { testCase: 'no callback', cb: undefined, expectedData: testEvent, expectedError: testError },
      { testCase: 'callback', cb: testCB, expectedData: testCBData, expectedError: testCBError }
    ].forEach(test => {
      describe(test.testCase, () => {
        it('should properly publish event to dlq', () => {
          this.sendMessageMock.once()
            .withExactArgs({
              MessageBody: JSON.stringify(testEvent),
              QueueUrl: dlqUrl,
              MessageAttributes: {
                'err.message': {
                  DataType: 'String',
                  StringValue: testError.message
                },
                'err.stack': {
                  DataType: 'String',
                  StringValue: testError.stack
                },
                'context.awsRequestId': {
                  DataType: 'String',
                  StringValue: this.testContext.awsRequestId
                }
              }
            }).returns(generateAWSPromise(testEvent));

          return expect(publisher.publish(testEvent, this.testContext, testError, test.cb))
            .to.eventually.equal(test.expectedData);
        });

        it('should throw when event publishing fails', () => {
          this.sendMessageMock.once()
            .returns(generateAWSPromise(() => Promise.reject(testError)));

          return expect(publisher.publish(testEvent, this.testContext, testError, test.cb))
            .to.eventually.be.rejectedWith(test.expectedError);
        });
      });
    });
  });
});
