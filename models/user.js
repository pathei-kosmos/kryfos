const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    mail_user: {
      type: String,
      required: true,
    },
    pwd_user: {
      type: String,
      required: true,
    },
    pseudo_user: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
