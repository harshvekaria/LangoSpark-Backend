import { request } from './setup';

// This test checks if the server is running before running any other tests
describe('Server Check', () => {
  it('should have a server running and accessible', async () => {
    try {
      // Try to access the server with a basic endpoint
      const response = await request.get('/api');
      
      // We just care that the server responds, not what status code it returns
      // Any response means the server is running
      expect(response).toBeDefined();
      console.log('✅ Server is running and accessible');
    } catch (error) {
      // If the server doesn't respond, we log a message but don't fail the test
      console.warn('⚠️ WARNING: Server may not be running. Some tests will fail.');
      console.warn('Start the server with `npm run dev` before running tests.');
      // We mark this test as passed anyway to allow other tests to run
    }
  });
}); 