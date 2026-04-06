import React, { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, query, orderBy, deleteDoc, limit } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { User, Address } from "../../types";
import { Search, Shield, ShieldAlert, User as UserIcon, Loader2, Mail, Phone, Trash2, X, MapPin, Calendar, Fingerprint, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import ConfirmModal from "../../components/ConfirmModal";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ ...doc.data() } as User)));
    } catch (err: any) {
      if (err.message?.includes('resource-exhausted') || err.message?.includes('Quota limit exceeded')) {
        try {
          handleFirestoreError(err, OperationType.GET, "users");
        } catch (quotaErr: any) {
          setError(quotaErr);
        }
      } else {
        console.error("Error fetching users:", err);
        toast.error("Failed to fetch users");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (user: User) => {
    if (user.uid === auth.currentUser?.uid) {
      toast.error("You cannot change your own role");
      return;
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmMessage = `Are you sure you want to ${newRole === 'admin' ? 'GRANT' : 'REVOKE'} admin privileges for ${user.displayName || user.phoneNumber}?`;
    
    setConfirmModal({
      isOpen: true,
      title: "Update Role",
      message: confirmMessage,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        setUpdatingId(user.uid);
        try {
          await updateDoc(doc(db, "users", user.uid), {
            role: newRole
          });
          toast.success(`Role updated to ${newRole}`);
          setUsers(users.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error("Error updating role:", error);
          toast.error("Failed to update role");
        } finally {
          setUpdatingId(null);
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const deleteUser = async (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (user.uid === auth.currentUser?.uid) {
      toast.error("You cannot delete your own account");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Delete User",
      message: `Are you sure you want to PERMANENTLY delete user ${user.displayName || user.phoneNumber}? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        setUpdatingId(user.uid);
        try {
          await deleteDoc(doc(db, "users", user.uid));
          toast.success("User deleted successfully");
          setUsers(users.filter(u => u.uid !== user.uid));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error("Error deleting user:", error);
          toast.error("Failed to delete user");
        } finally {
          setUpdatingId(null);
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const openUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phoneNumber.includes(searchTerm) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && users.length === 0) {
    return (
      <div className="space-y-12 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="h-12 w-64 bg-gray-100 dark:bg-gray-900 rounded-2xl animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-96 bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">User Management</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Manage roles and permissions</p>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white dark:bg-gray-950 rounded-[3rem] border border-gray-100 dark:border-gray-900 overflow-hidden shadow-xl shadow-black/5">
        <div className="p-8 border-b border-gray-50 dark:border-gray-900">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search users by name, phone or email..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-full focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 dark:border-gray-900">
                <th className="px-8 py-6">User</th>
                <th className="px-8 py-6">Contact Info</th>
                <th className="px-8 py-6">Joined</th>
                <th className="px-8 py-6">Role</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
              {filteredUsers.map(user => (
                <tr 
                  key={user.uid} 
                  onClick={() => openUserDetails(user)}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer group"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
                        {user.displayName ? user.displayName[0].toUpperCase() : <UserIcon size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-tight">{user.displayName || "Anonymous User"}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">UID: {user.uid.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs font-bold text-gray-500">
                        <Phone size={12} />
                        <span>{user.phoneNumber || "No Phone"}</span>
                      </div>
                      {user.email && (
                        <div className="flex items-center space-x-2 text-xs font-bold text-gray-500">
                          <Mail size={12} />
                          <span>{user.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRole(user);
                        }}
                        disabled={updatingId === user.uid || user.uid === auth.currentUser?.uid}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 ${user.role === 'admin' ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}
                        title={user.role === 'admin' ? "Revoke Admin" : "Make Admin"}
                      >
                        {updatingId === user.uid ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : user.role === 'admin' ? (
                          <ShieldAlert size={14} />
                        ) : (
                          <Shield size={14} />
                        )}
                        <span className="hidden sm:inline">{user.role === 'admin' ? "Revoke" : "Admin"}</span>
                      </button>
                      <button 
                        onClick={(e) => deleteUser(e, user)}
                        disabled={updatingId === user.uid || user.uid === auth.currentUser?.uid}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all disabled:opacity-50"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-gray-950 rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-900"
            >
              <div className="p-8 md:p-12">
                <div className="flex justify-between items-start mb-10">
                  <div className="flex items-center space-x-6">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black ${selectedUser.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedUser.displayName ? selectedUser.displayName[0].toUpperCase() : <UserIcon size={32} />}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-tighter uppercase">{selectedUser.displayName || "Anonymous User"}</h2>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedUser.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                          {selectedUser.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-2xl transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                        <Phone size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</p>
                        <p className="text-sm font-bold">{selectedUser.phoneNumber || "Not provided"}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                        <Mail size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address</p>
                        <p className="text-sm font-bold truncate">{selectedUser.email || "Not provided"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Joined Date</p>
                        <p className="text-sm font-bold">{new Date(selectedUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                        <Fingerprint size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">User ID</p>
                        <p className="text-sm font-bold font-mono">{selectedUser.uid}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <MapPin size={18} className="text-gray-400" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Saved Addresses</h3>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {selectedUser.addresses && selectedUser.addresses.length > 0 ? (
                      selectedUser.addresses.map((addr: Address) => (
                        <div key={addr.id} className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-black uppercase tracking-tight">{addr.name}</p>
                            <span className="text-[10px] font-bold text-gray-400">{addr.phone}</span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No saved addresses</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-gray-50 dark:border-gray-900 flex justify-end space-x-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={(e) => {
                      setIsModalOpen(false);
                      deleteUser(e, selectedUser);
                    }}
                    disabled={selectedUser.uid === auth.currentUser?.uid}
                    className="px-8 py-4 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    Delete User
                  </button>
                </div>
              </div>
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
  );
}
