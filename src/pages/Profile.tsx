import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { User, Address } from "../types";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { User as UserIcon, MapPin, Package, LogOut, Plus, Trash2, Edit2, X, Loader2, ShieldCheck, MessageCircle, AlertTriangle } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";
import { lookupPincode } from "../lib/pincode";

interface ProfileProps {
  user: User | null;
}

export default function Profile({ user }: ProfileProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (user) {
      if (!displayName && user.displayName) setDisplayName(user.displayName);
      if (!email && user.email) setEmail(user.email);
    }
  }, [user, displayName, email]);

  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({
    name: "",
    phone: "",
    pincode: "",
    address: "",
    city: "",
    state: "",
    isPrimary: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    isLoading: false
  });

  if (!user) return <Navigate to="/login" />;

  const handleLogout = () => {
    setConfirmModal({
      isOpen: true,
      title: "Logout",
      message: "Are you sure you want to log out of your account?",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await signOut(auth);
          toast.success("Logged out successfully");
          navigate("/");
        } catch (error) {
          toast.error("Failed to log out");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleUpdateProfile = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!displayName.trim()) {
      newErrors.displayName = "Display name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setProfileErrors(newErrors);
      return;
    }

    setProfileErrors({});
    try {
      await updateDoc(doc(db, "users", user.uid), { displayName, email });
      toast.success("Profile updated");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setErrors({});
    setNewAddress({
      name: user?.displayName || "",
      phone: user?.phoneNumber || "",
      pincode: "",
      address: "",
      city: "",
      state: "",
      isPrimary: (user.addresses?.length || 0) === 0
    });
    setIsAddingAddress(true);
  };

  const handleOpenEdit = (address: Address) => {
    setEditingAddress(address);
    setErrors({});
    setNewAddress(address);
    setIsAddingAddress(true);
  };

  const handleCloseModal = () => {
    setIsAddingAddress(false);
    setEditingAddress(null);
    setErrors({});
    setNewAddress({ name: "", phone: "", pincode: "", address: "", city: "", state: "", isPrimary: false });
  };

  const handlePincodeChange = async (pincode: string) => {
    setNewAddress(prev => ({ ...prev, pincode }));
    if (pincode.length === 6) {
      const data = await lookupPincode(pincode);
      if (data) {
        setNewAddress(prev => ({
          ...prev,
          city: data.city,
          state: data.state
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!newAddress.name?.trim()) newErrors.name = "Full name is required";
    if (!newAddress.phone?.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(newAddress.phone.trim())) {
      newErrors.phone = "Phone number must be exactly 10 digits";
    }
    if (!newAddress.address?.trim()) newErrors.address = "Address is required";
    if (!newAddress.city?.trim()) newErrors.city = "City is required";
    if (!newAddress.state?.trim()) newErrors.state = "State is required";
    if (!newAddress.pincode?.trim()) {
      newErrors.pincode = "Pincode is required";
    } else if (!/^\d{6}$/.test(newAddress.pincode.trim())) {
      newErrors.pincode = "Pincode must be exactly 6 digits";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      let updatedAddresses = [...(user.addresses || [])];
      
      if (newAddress.isPrimary) {
        updatedAddresses = updatedAddresses.map(addr => ({ ...addr, isPrimary: false }));
      }

      if (editingAddress) {
        updatedAddresses = updatedAddresses.map(addr => 
          addr.id === editingAddress.id ? { ...newAddress, id: addr.id } as Address : addr
        );
      } else {
        const addressToAdd = {
          ...newAddress,
          id: Math.random().toString(36).slice(2)
        } as Address;
        updatedAddresses.push(addressToAdd);
      }

      await updateDoc(doc(db, "users", user.uid), {
        addresses: updatedAddresses
      });
      toast.success(editingAddress ? "Address updated successfully" : "Address added successfully");
      handleCloseModal();
    } catch (error) {
      toast.error(editingAddress ? "Failed to update address" : "Failed to add address");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (address: Address) => {
    try {
      const updatedAddresses = (user.addresses || []).map(addr => ({
        ...addr,
        isPrimary: addr.id === address.id
      }));
      await updateDoc(doc(db, "users", user.uid), {
        addresses: updatedAddresses
      });
      toast.success("Primary address updated");
    } catch (error) {
      toast.error("Failed to set primary address");
    }
  };

  const handleDeleteAddress = async (address: Address) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Address",
      message: "Are you sure you want to delete this address?",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await updateDoc(doc(db, "users", user.uid), {
            addresses: arrayRemove(address)
          });
          toast.success("Address deleted");
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error("Failed to delete address");
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-5xl font-black tracking-tighter uppercase mb-12">Account</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-900 shadow-xl shadow-black/5">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center">
                <UserIcon size={32} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight truncate max-w-[150px]">
                  {user.displayName || "User"}
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{user.phoneNumber}</p>
              </div>
            </div>

            <nav className="space-y-2">
              {user.role === 'admin' && (
                <button onClick={() => navigate("/admin")} className="w-full flex items-center space-x-4 p-4 rounded-2xl bg-purple-600 text-white transition-colors text-sm font-bold uppercase tracking-widest mb-4">
                  <ShieldCheck size={20} />
                  <span>Admin Dashboard</span>
                </button>
              )}
              <button onClick={() => navigate("/orders")} className="w-full flex items-center space-x-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-bold uppercase tracking-widest">
                <Package size={20} />
                <span>My Orders</span>
              </button>
              <button className="w-full flex items-center space-x-4 p-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black transition-colors text-sm font-bold uppercase tracking-widest">
                <UserIcon size={20} />
                <span>Profile Settings</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center space-x-4 p-4 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-sm font-bold uppercase tracking-widest">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
              
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-chatbot'))}
                className="w-full flex items-center space-x-4 p-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black transition-colors text-sm font-bold uppercase tracking-widest mt-4 shadow-lg shadow-black/10"
              >
                <MessageCircle size={20} />
                <span>Support Chat</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Info */}
          <section className="bg-white dark:bg-gray-950 p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-900">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tighter uppercase">Personal Info</h3>
              <button 
                onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)}
                className="text-xs font-black uppercase tracking-widest underline underline-offset-4"
              >
                {isEditing ? "Save Changes" : "Edit Profile"}
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Display Name</label>
                {isEditing ? (
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${profileErrors.displayName ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    {profileErrors.displayName && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{profileErrors.displayName}</p>}
                  </div>
                ) : (
                  <p className="text-lg font-bold">{user.displayName || "Not set"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address</label>
                {isEditing ? (
                  <div className="space-y-1">
                    <input 
                      type="email" 
                      className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${profileErrors.email ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                    {profileErrors.email && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{profileErrors.email}</p>}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold">{user.email || "Not set"}</p>
                    {!user.email && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] font-black uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full hover:scale-105 transition-transform"
                      >
                        Add Email
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                <p className="text-lg font-bold">{user.phoneNumber}</p>
              </div>
            </div>
          </section>

          {/* Addresses */}
          <section className="bg-white dark:bg-gray-950 p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-900">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tighter uppercase">Saved Addresses</h3>
              <button 
                onClick={handleOpenAdd}
                className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full hover:scale-105 transition-transform"
              >
                <Plus size={16} />
                <span>Add New</span>
              </button>
            </div>

            <div className="space-y-4">
              {(user.addresses?.length || 0) > 0 ? (
                user.addresses?.map(addr => (
                  <div key={addr.id} className={`p-6 rounded-3xl flex justify-between items-start border-2 transition-all ${addr.isPrimary ? 'bg-black text-white border-black shadow-2xl shadow-black/40 scale-[1.02] ring-4 ring-black/5' : 'bg-gray-50 dark:bg-gray-900 border-transparent'}`}>
                    <div className="flex-grow">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-bold uppercase tracking-tight">{addr.name}</h4>
                        {addr.isPrimary && (
                          <span className="bg-white text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Primary</span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${addr.isPrimary ? 'text-gray-300' : 'text-gray-500'}`}>
                        {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className={`text-xs font-bold mt-2 ${addr.isPrimary ? 'text-gray-400' : 'text-gray-400'}`}>{addr.phone}</p>
                      
                      {!addr.isPrimary && (
                        <button 
                          onClick={() => handleSetPrimary(addr)}
                          className="mt-4 text-[10px] font-black uppercase tracking-widest underline underline-offset-4 hover:text-black dark:hover:text-white transition-colors"
                        >
                          Set as Primary
                        </button>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleOpenEdit(addr)}
                        className={`p-2 rounded-full transition-colors ${addr.isPrimary ? 'hover:bg-white/10' : 'hover:bg-white dark:hover:bg-black'}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteAddress(addr)}
                        className={`p-2 rounded-full transition-colors ${addr.isPrimary ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500'}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-100 dark:border-gray-900 rounded-3xl">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No addresses saved yet</p>
                </div>
              )}
            </div>
          </section>

          {/* Add Address Modal */}
          <AnimatePresence>
            {isAddingAddress && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-lg bg-white dark:bg-gray-950 rounded-[3rem] overflow-hidden shadow-2xl"
                >
                  <div className="p-8 border-b border-gray-100 dark:border-gray-900 flex justify-between items-center">
                    <h2 className="text-2xl font-black tracking-tighter uppercase">{editingAddress ? "Edit Address" : "Add New Address"}</h2>
                    <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full"><X size={24} /></button>
                  </div>

                  <form onSubmit={handleAddAddress} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</label>
                        <input 
                          type="text" 
                          className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${errors.name ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                          value={newAddress.name}
                          onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                        />
                        {errors.name && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{errors.name}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                        <input 
                          type="tel" 
                          className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${errors.phone ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                          value={newAddress.phone}
                          onChange={(e) => setNewAddress({...newAddress, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                        />
                        {errors.phone && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{errors.phone}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Address (House No, Street, Area)</label>
                      <input 
                        type="text" 
                        className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${errors.address ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                        value={newAddress.address}
                        onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                      />
                      {errors.address && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{errors.address}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">City</label>
                        <input 
                          type="text" 
                          className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${errors.city ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                        />
                        {errors.city && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{errors.city}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pincode</label>
                        <input 
                          type="text" 
                          maxLength={6}
                          className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${errors.pincode ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                          value={newAddress.pincode}
                          onChange={(e) => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                        {errors.pincode && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{errors.pincode}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">State</label>
                      <input 
                        type="text" 
                        className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 transition-all font-bold ${errors.state ? 'ring-2 ring-red-500' : 'focus:ring-black dark:focus:ring-white'}`}
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                      />
                      {errors.state && <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-2">{errors.state}</p>}
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                      <input 
                        type="checkbox" 
                        id="isPrimary"
                        className="w-5 h-5 rounded-lg accent-black dark:accent-white"
                        checked={newAddress.isPrimary}
                        onChange={(e) => setNewAddress({...newAddress, isPrimary: e.target.checked})}
                      />
                      <label htmlFor="isPrimary" className="text-xs font-black uppercase tracking-widest cursor-pointer">Set as Primary Address</label>
                    </div>

                    <div className="pt-4 flex space-x-4">
                      <button 
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-grow py-5 bg-gray-100 dark:bg-gray-900 text-black dark:text-white font-black text-sm uppercase tracking-widest rounded-full hover:opacity-70 transition-opacity"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-[2] py-5 bg-black dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (editingAddress ? "Update Address" : "Save Address")}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <ConfirmModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmModal.onConfirm}
            title={confirmModal.title}
            message={confirmModal.message}
            isLoading={confirmModal.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
