export const load = async ({ locals }) => {
  // Make user available to the client on every page
  return { user: locals.user };
};