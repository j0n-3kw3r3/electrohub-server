const express = require("express");
const router = express.Router();
const upload = require("../middleware/multer");
const multipleUpload = require("../middleware/multipleUpload");
const {  admin, protect } = require("../middleware/authMiddleware");
const {
  getProducts,
  deleteProduct,
  updateProduct,
  createProduct,
  getProductById,
  likeProduct,
  reviewProduct,
  UnLikeProduct,
} = require("../controllers/productController");

router.route("/").get(getProducts);
router.route("/review/:userId/:productId").put( reviewProduct);
router.route("/").post(upload.array("images"), multipleUpload, protect, admin, createProduct);
router.route("/:id").put(upload.array("images"), protect, admin, updateProduct);
router.route("/delete/:id").delete(protect, admin, deleteProduct);
router.route("/:id").get(getProductById);

module.exports = router;
