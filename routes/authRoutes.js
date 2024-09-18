const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUserById,
  getMe,
  registerUser,
  updateUser,
  deleteUser,
  loginUser,
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");

router.route("/login").post(loginUser);
router.route("/register").post(registerUser);
router.route("/").get(getUsers);
router.route("/me").get( protect, getMe);
router.route("/:id").get(getUserById);
router.route("/:id").put(upload.array("image"), updateUser);
router.route("/:id").delete(deleteUser);

module.exports = router;
