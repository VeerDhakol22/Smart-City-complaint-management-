// Middleware to protect routes that require citizen authentication
function requireUserAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please login as a citizen to continue.'
    });
}

module.exports = {
    requireUserAuth
};

