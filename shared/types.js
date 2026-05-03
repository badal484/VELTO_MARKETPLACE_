"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutRequestStatus = exports.OrderStatus = exports.Category = exports.Role = void 0;
var Role;
(function (Role) {
    Role["BUYER"] = "buyer";
    Role["SELLER"] = "seller";
    Role["SHOP_OWNER"] = "shop_owner";
    Role["RIDER"] = "rider";
    Role["ADMIN"] = "admin";
})(Role || (exports.Role = Role = {}));
var Category;
(function (Category) {
    Category["ELECTRONICS"] = "Electronics";
    Category["CLOTHING"] = "Clothing";
    Category["FOOD"] = "Food";
    Category["BOOKS"] = "Books";
    Category["HOME"] = "Home";
    Category["CONSTRUCTION"] = "Construction";
    Category["SPORTS"] = "Sports";
    Category["TOYS"] = "Toys";
    Category["HEALTH"] = "Health";
    Category["OTHER"] = "Other";
})(Category || (exports.Category = Category = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "Pending";
    OrderStatus["PAYMENT_UNDER_REVIEW"] = "Payment Under Review";
    OrderStatus["CONFIRMED"] = "Confirmed";
    OrderStatus["READY_FOR_PICKUP"] = "Ready for Pickup";
    OrderStatus["SEARCHING_RIDER"] = "Searching Rider";
    OrderStatus["RIDER_ASSIGNED"] = "Rider Assigned";
    OrderStatus["AT_SHOP"] = "At Shop";
    OrderStatus["PICKED_UP"] = "Picked Up";
    OrderStatus["IN_TRANSIT"] = "In Transit";
    OrderStatus["DELIVERED"] = "Delivered";
    OrderStatus["COMPLETED_PENDING_RELEASE"] = "Completed Pending Release";
    OrderStatus["COMPLETED"] = "Completed";
    OrderStatus["CANCELLED"] = "Cancelled";
    OrderStatus["PRICE_LOCKED"] = "Price Locked";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PayoutRequestStatus;
(function (PayoutRequestStatus) {
    PayoutRequestStatus["PENDING"] = "pending";
    PayoutRequestStatus["PROCESSING"] = "processing";
    PayoutRequestStatus["COMPLETED"] = "completed";
    PayoutRequestStatus["REJECTED"] = "rejected";
})(PayoutRequestStatus || (exports.PayoutRequestStatus = PayoutRequestStatus = {}));
