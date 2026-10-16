import { Router } from 'express';

/** Reports which build is running, so a deployment can be matched to a release tag. */
export function versionRouter() {
  const r = Router();
  r.get('/version', (_req, res) => {
    res.json({
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      node: process.version,
    });
  });
  return r;
}
