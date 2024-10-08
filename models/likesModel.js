const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

likeSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

likeSchema.set("toJSON", {
  virtuals: true,
});

const Like = mongoose.model('Like', likeSchema);

module.exports = Like;