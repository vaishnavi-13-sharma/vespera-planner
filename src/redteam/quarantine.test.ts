// Keeps `npm run test:redteam` runnable before any attacker test exists.
it('the red-team quarantine runs on its own', () => {
  expect(process.env.VESPERA_REDTEAM).toBe('1');
});
