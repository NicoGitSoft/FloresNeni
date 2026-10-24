import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import WebpayPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [WebpayPaymentProviderService],
})
