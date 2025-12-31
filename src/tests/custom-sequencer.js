const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Get server check test first
    const serverCheckTest = tests.find(test => 
      test.path.includes('_check-server.test')
    );
    
    // Put the server check test first
    if (serverCheckTest) {
      const otherTests = tests.filter(test => 
        !test.path.includes('_check-server.test')
      );
      
      return [serverCheckTest, ...otherTests];
    }
    
    // If no server check test, use default sorting
    return super.sort(tests);
  }
}

module.exports = CustomSequencer; 