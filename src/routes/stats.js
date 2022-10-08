import express from 'express';
import group from '../api/authGroup/api';
import m from '../middleware';

const router = express.Router();

// Stats
router.get('/:group/usage-stats', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('group')], group.stats);

export default router;