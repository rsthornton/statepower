export const REPO = "https://github.com/rsthornton/statepower";
/** A file in the public repository, on main. Paths still on unmerged branches are listed in docs/next-site/LOG.md. */
export const repoFile = (path: string) => `${REPO}/blob/main/${path}`;
