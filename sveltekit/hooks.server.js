/**
 * @typedef {import("@sveltejs/kit").RequestEvent} RequestEvent
 * @typedef {import("@sveltejs/kit").ResolveOptions} ResolveOptions
 */

/**
 * SvelteKit server hook that handles incoming requests
 * @param {Object} params - The parameters object
 * @param {RequestEvent} params.event - The request event object
 * @param {(event: RequestEvent, opts?: ResolveOptions) => Promise<Response>} params.resolve - Function to resolve the request
 * @returns {Promise<Response>} The response object
 */
export async function handle({ event, resolve }) {
  const { setHeaders } = event;
  setHeaders({
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  return await resolve(event);
}
