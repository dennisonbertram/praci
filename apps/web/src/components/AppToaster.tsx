import { NotificationToaster } from "@rakazo/ui-web";
import { useNavigate } from "react-router-dom";
import { i18n } from "../lib/i18n";

/** Mounted once at the app root; notifications enter through `deliverNotification`. */
export function AppToaster() {
  const navigate = useNavigate();
  return (
    <NotificationToaster
      onOpen={navigate}
      dismissLabel={i18n._({ id: "Dismiss", message: "Dismiss" })}
    />
  );
}
