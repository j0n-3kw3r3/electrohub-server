const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const cloudinary = require("../utils/cloudinary");
const Address = require("../models/addressModel");
const nodemailer = require("nodemailer");
const Cart = require("../models/cartModel"); 

//@desc     Create user
//@route    POST /api/users
//@access   Public
const registerUser = asyncHandler(async (req, res) => {
  const {  email, password, role } = req.body;
  if ( !email || !password) {
    res.status(400);
    throw new Error("Please add all fields");
  }

  // check if user exsits
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400).json("User already exists");
    throw new Error("User already exists");
  }

  // hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // create user
  const user = await User.create({
    email,
    password: hashedPassword,
    role: role || "user",
  });

  if (user) {
    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user?.role,
      token: generateToken(user.id),
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

//@desc     Login user
//@route    POST /api/users/login
//@access   Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Please add all fields");
  }

  // check if user exsits
  const user = await User.findOne({ email }).populate("address", "-__v");
  if (!user) {
    res.status(400);
    throw new Error("Invalid credentials");
  } else {
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      res.status(200).json({
        role: user.role,
        profilePicture: user.profilePicture,
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        address: user.address,
        phone: user.phone,
        likes: user.likes,
        dateOfBirth: user.dateOfBirth,
        wishlist: user.wishlist,
        cart: user.cart,
        token: generateToken(user.id),
      });
    } else {
      res.status(400);
      throw new Error("Invalid credentials");
    }
  }
});

//@desc     Get all users
//@route    GET /api/users
//@access   Public
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select("-password")
    .populate("address", "-__v")
    .populate("likes")
    .populate("wishlist")
    .populate("cart")
    .populate("address");
  res.status(200).json(users);
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.status(200).json(user);

  res.status(200).json({
    id: id,
    firstName: user.firstName,
    email: user.email,
  });
});

//@desc     Get single user
//@route    GET /api/users/:id
//@access   Public
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password -createdAt -__v");

  res.status(200).json(user);
});

//@desc     Update user
//@route    PUT /api/users/:id
//@access   Public
const updateUser = asyncHandler(async (req, res) => {
  const image = req.files[0];
  const {
    firstName,
    lastName,
    profilePicture,
    email,
    city,
    street,
    state,
    country,
    postalCode,
    phone,
    likes,
    dateOfBirth,
    wishlist,
    cart,
    role,
  } = req.body;

  const newAddress = new Address({
    street,
    city,
    state,
    country,
    postalCode,
  });

  const address = await newAddress.save();

  const user = await User.findById(req.params.id);

  let data = {
    firstName,
    lastName,
    profilePicture,
    firstName,
    email,
    address: address.id,
    phone,
    likes,
    dateOfBirth,
    wishlist,
    cart,
  };
  if (user.role === "admin") {
    data = {
      ...data,
      role,
    };
  }
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (image) {
    // delete images
    const deleteProfilePicture = async (user) => {
      const imageId = user.profilePicture;

      if (imageId) {
        try {
          // Await the result of the deletion promise
          const deletionResult = await cloudinary.uploader.destroy(imageId[0].public_id);

          // Check if the deletion was successful
          if (deletionResult.result === "ok") {
            console.log("Successfully deleted the image");
          } else {
            console.error("Failed to delete the image:", deletionResult);
          }
        } catch (error) {
          // Handle any errors that occur during deletion
          console.error("Error during image deletion:", error);
        }
      }
    };

    // Example usage of async function
    await deleteProfilePicture(user);
    // image url to cloudinary

    const result = await cloudinary.uploader.upload(image.path, {
      upload_preset: "onlineShop",
      resource_type: "auto",
    });
    const imageObject = {
      url: result.secure_url,
      public_id: result.public_id,
    };
    data.profilePicture = imageObject;
  }
  await user.updateOne(data);
  res.status(200).json({ message: `Updated user with id ${req.params.id}!` });
});

//@desc   toggle user role
//@route  PUT /api/users/:id/toggle-role
//@access Private
const toggleRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  const role = user.role === "admin" ? "user" : "admin";
  await user.updateOne({ role });
  res.status(200).json({ message: `Updated user role with id ${req.params.id}!` });
});

//@desc     change password
//@route    PUT /api/users/:id/change-password
//@access   Public
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    res.status(400);
    throw new Error("Invalid credentials");
  }
  // check that old password is not the same as new password
  const isSame = await bcrypt.compare(newPassword, user.password);
  if (isSame) {
    res.status(400);
    throw new Error("New password cannot be the same as old password");
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  await user.updateOne({ password: hashedPassword });
  res.status(200).json({ message: `Updated user password with id ${req.params.id}!` });
});

//@desc     Forgot password
//@route    POST /api/users/forgot-password
//@access   Public
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Generate reset token
  const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  // Set token and expiration on user
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

  await user.save();

  // Create reset URL
  const resetUrl = `${process.env.CLIENT_URL}/auth/reset-password/${resetToken}`;

  const message = `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
           Please click on the following link, or paste this into your browser to complete the process:\n\n
           ${resetUrl}\n\n
           If you did not request this, please ignore this email and your password will remain unchanged.\n`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset",
      text: message,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
        res.status(500);
        throw new Error("Error sending email");
      } else {
        res.status(200).json({ message: "Email sent", info });
      }
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.status(500);
    throw new Error("Email could not be sent");
  }
});

//@desc     Reset password
//@route    POST /api/users/reset-password/:resetToken
//@access   Public
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired token");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({ message: "Password reset successful" });
});

//@desc     Delete user
//@route    DELETE /api/users/:id
//@access   Public
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  // get address from user.address and find
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  const address = await Address.findById(user.address);
  if (!address) {
    console.log("No address found");
  }
  await address.deleteOne();
  await user.deleteOne();
  res.status(200).json({ message: `Deleted user with id ${req.params.id}!` });
});

//@desc     Add Products to a Cart
//@route    POST /api/auth/carts/:userId/products
//@access   Private
const addProductsToCart = asyncHandler(async (req, res) => {
  const cartItems = req.body;
  const userId = req.params.userId;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const cart = await Cart.findById(user.cart).populate("products.product");

  if (cart) {
    for (let index = 0; index < cartItems.length; index++) {
      const existingProduct = cart.products.find((p) => p.product.id.toString() === cartItems[index].id);
      cartItems[index].id;
      if (existingProduct) {
        existingProduct.cartQuantity = cartItems[index].cartQuantity;
        const newCart = await cart.save();
        await user.updateOne({ cart: newCart.id });
      } else {
        cart.products.push({ product: cartItems[index].id, quantity: cartItems[index].cartQuantity });
        const newCart = await cart.save();
        await user.updateOne({ cart: newCart.id });
      }
    }
  } else {
    const newCart = new Cart({
      products: [],
    });
    for (let index = 0; index < cartItems.length; index++) {
      newCart.products.push({ product: cartItems[index].id, quantity: cartItems[index].cartQuantity });
    }
    const cart = await newCart.save();
    await user.updateOne({ cart: cart.id });
  }

  res.status(200).json({ message: `Added products to cart with id ${user.cart}!` });
});

// Generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

module.exports = {
  getUsers,
  getMe,
  registerUser,
  updateUser,
  deleteUser,
  loginUser,
  getUserById,
  toggleRole,
  changePassword,
  forgotPassword,
  resetPassword,
  addProductsToCart,
};
