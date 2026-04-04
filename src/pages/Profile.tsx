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

interface ProfileProps {
  user: User | null;
}

export default function Profile({ user }: ProfileProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");

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
    state: ""
  });

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

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleUpdateProfile = async () => {
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
    setNewAddress({
      name: user?.displayName || "",
      phone: user?.phoneNumber || "",
      pincode: "",
      address: "",
      city: "",
      state: ""
    });
    setIsAddingAddress(true);
  };

  const handleOpenEdit = (address: Address) => {
    setEditingAddress(address);
    setNewAddress(address);
    setIsAddingAddress(true);
  };

  const handleCloseModal = () => {
    setIsAddingAddress(false);
    setEditingAddress(null);
    setNewAddress({ name: "", phone: "", pincode: "", address: "", city: "", state: "" });
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newAddress.name?.trim()) return toast.error("Name is required");
    if (!newAddress.phone?.trim()) return toast.error("Phone number is required");
    if (!/^\d{10}$/.test(newAddress.phone.trim())) return toast.error("Phone number must be 10 digits");
    if (!newAddress.address?.trim()) return toast.error("Address is required");
    if (!newAddress.city?.trim()) return toast.error("City is required");
    if (!newAddress.state?.trim()) return toast.error("State is required");
    if (!newAddress.pincode?.trim()) return toast.error("Pincode is required");
    if (!/^\d{6}$/.test(newAddress.pincode.trim())) return toast.error("Pincode must be 6 digits");

    setLoading(true);
    try {
      if (editingAddress) {
        // Update existing address
        const updatedAddresses = (user.addresses || []).map(addr => 
          addr.id === editingAddress.id ? { ...newAddress, id: addr.id } as Address : addr
        );
        await updateDoc(doc(db, "users", user.uid), {
          addresses: updatedAddresses
        });
        toast.success("Address updated successfully");
      } else {
        // Add new address
        const addressToAdd = {
          ...newAddress,
          id: Math.random().toString(36).slice(2)
        } as Address;

        await updateDoc(doc(db, "users", user.uid), {
          addresses: arrayUnion(addressToAdd)
        });
        toast.success("Address added successfully");
      }

      handleCloseModal();
    } catch (error) {
      toast.error(editingAddress ? "Failed to update address" : "Failed to add address");
    } finally {
      setLoading(false);
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
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                ) : (
                  <p className="text-lg font-bold">{user.displayName || "Not set"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address</label>
                {isEditing ? (
                  <input 
                    type="email" 
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
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
                  <div key={addr.id} className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl flex justify-between items-start">
                    <div>
                      <h4 className="font-bold uppercase tracking-tight mb-1">{addr.name}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className="text-xs font-bold mt-2 text-gray-400">{addr.phone}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleOpenEdit(addr)}
                        className="p-2 hover:bg-white dark:hover:bg-black rounded-full transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteAddress(addr)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-full transition-colors"
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
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={newAddress.name}
                          onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                        <input 
                          type="tel" 
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={newAddress.phone}
                          onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Address (House No, Street, Area)</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={newAddress.address}
                        onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">City</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pincode</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">State</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                      />
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
