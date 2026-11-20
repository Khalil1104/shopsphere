const Joi = require("joi");
const Order = require("../models/order");

const objectId = Joi.string().hex().length(24);

const addressSchema = Joi.object({
  street: Joi.string().min(3).required(),
  city: Joi.string().required(),
  governorate: Joi.string().required(),
  postalCode: Joi.string().allow(""),
  phone: Joi.string().pattern(/^[0-9+ ]{8,15}$/).required(),
});

const schemas = {
  addItem: Joi.object({
    productId: objectId.required(),
    quantity: Joi.number().integer().min(1).max(100).default(1),
  }),
  updateItem: Joi.object({
    quantity: Joi.number().integer().min(1).max(100).required(),
  }),
  createOrder: Joi.object({ address: addressSchema.required() }),
  updateOrder: Joi.object({ address: addressSchema.required() }),
  changeStatus: Joi.object({
    status: Joi.string().valid(...Order.STATUSES).required(),
  }),
  listQuery: Joi.object({
    search: Joi.string().allow(""),
    status: Joi.string().valid(...Order.STATUSES),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
  statsQuery: Joi.object({
    period: Joi.string().valid("day", "month").default("day"),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
    limit: Joi.number().integer().min(1).max(50).default(5),
  }),
};

function validate(schema, source = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });
    }
    req[source] = value;
    next();
  };
}

function validateObjectId(param) {
  return (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params[param])) {
      return res.status(400).json({ message: "Identifiant invalide" });
    }
    next();
  };
}

module.exports = { validate, validateObjectId, schemas };