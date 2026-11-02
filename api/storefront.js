import handler from './index.js';

export default async function storefrontHandler(req, res) {
  req.url = '/storefront';
  return handler(req, res);
}
