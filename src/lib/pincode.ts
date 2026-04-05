import { toast } from "react-hot-toast";

export interface PincodeData {
  city: string;
  state: string;
}

export async function lookupPincode(pincode: string): Promise<PincodeData | null> {
  if (!/^\d{6}$/.test(pincode)) {
    return null;
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();

    if (data[0].Status === "Success") {
      const postOffice = data[0].PostOffice[0];
      return {
        city: postOffice.District,
        state: postOffice.State
      };
    } else {
      toast.error("Invalid Pincode");
      return null;
    }
  } catch (error) {
    console.error("Pincode lookup failed:", error);
    return null;
  }
}
