import express from 'express';
import int from '../api/oidc/interactions/api';
import m from '../middleware';

const router = express.Router();

// External Interaction API
router.post('/:group/interaction', [
	m.setNoCache,
	m.validateAuthGroup,
], int.createInt);

export default router;