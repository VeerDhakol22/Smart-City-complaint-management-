// Middleware to protect routes that require administrator authentication
function requireAdminAuth(req, res, next) {
    if (req.session && req.session.adminId) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Forbidden. Administrative authorization required.'
    });
}

module.exports = {
    requireAdminAuth
};

