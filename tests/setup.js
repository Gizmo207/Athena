// Test setup - add any global test configuration here
expect.extend({
  toMatchRegexIgnoreCase(received, regex) {
    const pass = new RegExp(regex, 'i').test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to match ${regex}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to match ${regex}`,
        pass: false,
      };
    }
  },
});
