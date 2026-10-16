// Answers the auth session request the shell makes on load. This must be imported before
// anything that loads the auth client, because the client keeps the fetch it finds at that point.
const original = window.fetch;
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/api/auth/get-session")
    ? Promise.resolve(
        Response.json({
          session: {
            id: "sess_demo",
            userId: "user_demo",
            expiresAt: "2099-01-01T00:00:00.000Z",
            token: "demo",
          },
          user: {
            id: "user_demo",
            name: "Demo User",
            email: "demo@example.com",
            emailVerified: true,
          },
        }),
      )
    : original(input, init);
};
