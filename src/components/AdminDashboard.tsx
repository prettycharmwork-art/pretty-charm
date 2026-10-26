import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  FolderKanban,
  Warehouse,
  Truck,
  ShoppingBag,
  Users,
  TrendingUp,
  Calculator,
  Receipt,
  MapPin,
  FileSpreadsheet,
  MessageCircle,
  Settings,
  ShieldCheck,
  LogOut,
  Plus,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  Search,
  RotateCcw,
  Globe,
  Building2,
  Info,
  Loader2,
} from 'lucide-react';
import {
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  validateIndianPinCodeFormat,
  ALL_INDIAN_STATES_AND_UTS,
} from '../shared/domainLogic';
import { ARTWORK } from '../assets/productArtwork';

interface AdminDashboardProps {
  onBackToStorefront: () => void;
  onCatalogueUpdated: () => void;
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'purchases'
  | 'orders'
  | 'customers'
  | 'sales'
  | 'profit'
  | 'expenses'
  | 'shipping'
  | 'exports'
  | 'integrations'
  | 'settings'
  | 'audit';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToStorefront,
  onCatalogueUpdated,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [bootstrapped, setBootstrapped] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('owner@prettycharm.in');
  const [passwordInput, setPasswordInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('Pretty Charm Owner');
  const [bootstrapTokenInput, setBootstrapTokenInput] = useState('');

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Date range filter for Sales & Profit reports
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Product Form State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState('gift-hampers');
  const [prodDescription, setProdDescription] = useState('');
  const [prodPriceRupees, setProdPriceRupees] = useState('299');
  const [prodCostRupees, setProdCostRupees] = useState('140');
  const [prodPkgRupees, setProdPkgRupees] = useState('25');
  const [prodStock, setProdStock] = useState('10');
  const [prodLowStock, setProdLowStock] = useState('5');
  const [prodStatus, setProdStatus] = useState('draft');
  const [prodConfirmed, setProdConfirmed] = useState(false);

  // Inventory Adjustment State
  const [adjProductId, setAdjProductId] = useState('');
  const [adjType, setAdjType] = useState('adjustment');
  const [adjDelta, setAdjDelta] = useState('5');
  const [adjReason, setAdjReason] = useState('');

  // Purchase Order / Goods Receipt State
  const [poSupplierId, setPoSupplierId] = useState('sup-1');
  const [poNumber, setPoNumber] = useState(`PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [poProductId, setPoProductId] = useState('prod-pearl-claw');
  const [poQty, setPoQty] = useState('10');
  const [poUnitCostRupees, setPoUnitCostRupees] = useState('95');
  const [poNotes, setPoNotes] = useState('');

  // Supplier Form State
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCity, setSupCity] = useState('Gurugram');
  const [supState, setSupState] = useState('Haryana');

  // Order Action & Filter State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [courierInput, setCourierInput] = useState('');
  const [awbInput, setAwbInput] = useState('');
  const [trackingUrlInput, setTrackingUrlInput] = useState('');
  const [etaInput, setEtaInput] = useState('');
  const [actualCourierCostRupees, setActualCourierCostRupees] = useState('');
  const [shipmentStatusInput, setShipmentStatusInput] = useState('AWB Assigned');
  const [shipmentEventLabel, setShipmentEventLabel] = useState('');

  // Expense Form State
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('packaging');
  const [expAmountRupees, setExpAmountRupees] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expNotes, setExpNotes] = useState('');

  // PIN code & Delivery Policy Form State
  const [pinCodeInput, setPinCodeInput] = useState('');
  const [pinCityInput, setPinCityInput] = useState('');
  const [pinDistrictInput, setPinDistrictInput] = useState('');
  const [pinStateInput, setPinStateInput] = useState('Haryana');
  const [pinIsServiceable, setPinIsServiceable] = useState(true);
  const [pinCodAvailable, setPinCodAvailable] = useState(false);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinSearchQuery, setPinSearchQuery] = useState('');
  const [pinFilterStatus, setPinFilterStatus] = useState<'all' | 'serviceable' | 'unserviceable'>('all');

  // Delivery Policy form state
  const [deliveryPolicyMode, setDeliveryPolicyMode] = useState<'pan_india' | 'whitelist_only'>('pan_india');
  const [deliveryPolicyCodRule, setDeliveryPolicyCodRule] = useState<'all_serviceable' | 'whitelist_only' | 'disabled'>('whitelist_only');
  const [deliveryMinDays, setDeliveryMinDays] = useState(3);
  const [deliveryMaxDays, setDeliveryMaxDays] = useState(6);
  const [deliveryNotice, setDeliveryNotice] = useState('Standard Pan-India courier dispatch from Gurugram (122001), Haryana.');
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Original Product Photo Audit & Approval State
  const [selectedPhotoProductId, setSelectedPhotoProductId] = useState<string>('prod-pearl-claw');
  const [candidateImageUrl, setCandidateImageUrl] = useState<string>('');
  const [candidateSourceUrl, setCandidateSourceUrl] = useState<string>('');
  const [candidateSourceDomain, setCandidateSourceDomain] = useState<string>('prettycharm.in');
  const [candidateLicenseNotes, setCandidateLicenseNotes] = useState<string>(
    'Official Pretty Charm Gurugram studio photograph — commercial catalogue reuse permitted'
  );
  const [candidateExactMatch, setCandidateExactMatch] = useState<boolean>(true);
  const [candidateReusePermitted, setCandidateReusePermitted] = useState<boolean>(true);
  const [candidateIsAiGenerated, setCandidateIsAiGenerated] = useState<boolean>(false);
  const [preserveExistingImages, setPreserveExistingImages] = useState<boolean>(true);
  const [setApprovedAsPrimary, setSetApprovedAsPrimary] = useState<boolean>(true);
  const [searchingPhotoProductId, setSearchingPhotoProductId] = useState<string | null>(null);
  const [findingAllImages, setFindingAllImages] = useState<boolean>(false);
  const [approvingBatch, setApprovingBatch] = useState<boolean>(false);
  const [generatingAiProductId, setGeneratingAiProductId] = useState<string | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<any | null>(null);
  const [filterAiOnly, setFilterAiOnly] = useState<boolean>(false);
  const [filterEligibleOnly, setFilterEligibleOnly] = useState<boolean>(false);
  const [productSubTab, setProductSubTab] = useState<'catalogue' | 'reviews'>('catalogue');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [categoryImageInputs, setCategoryImageInputs] = useState<Record<string, string>>({});
  const [categoryImageUploading, setCategoryImageUploading] = useState<Record<string, boolean>>({});
  const [productDirectUploading, setProductDirectUploading] = useState<Record<string, boolean>>({});
  const [comboOffersDraft, setComboOffersDraft] = useState<any[] | null>(null);
  const [savingCombos, setSavingCombos] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((st) => setBootstrapped(Boolean(st.bootstrapped)))
      .catch(() => {});
  }, []);

  const fetchOverview = async (authToken = token) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const qs =
        startDate && endDate
          ? `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
          : '';
      const res = await fetch(`/api/admin/overview${qs}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load admin data');
      setData(json);
      if (!adjProductId && json.products?.length > 0) {
        setAdjProductId(json.products[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapOrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint = bootstrapped ? '/api/admin/login' : '/api/admin/bootstrap';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
          fullName: fullNameInput,
          bootstrapToken: bootstrapTokenInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Authentication failed');
      setToken(json.token);
      setAdminUser(json.admin);
      setBootstrapped(true);
      await fetchOverview(json.token);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setErrorMsg(null);
    setTimeout(() => setFeedback(null), 5000);
  };

  const startEditingProduct = (p: any) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdCategory(p.categorySlug);
    setProdDescription(p.description);
    setProdPriceRupees(String(paiseToRupees(p.sellingPricePaise)));
    setProdCostRupees(String(paiseToRupees(p.purchaseCostPaise)));
    setProdPkgRupees(String(paiseToRupees(p.packagingCostPaise)));
    setProdStock(String(p.stockQty));
    setProdLowStock(String(p.lowStockThreshold));
    setProdStatus(p.status);
    setProdConfirmed(Boolean(p.confirmedByAdmin));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingProduct?.id,
          name: prodName,
          sku: prodSku,
          categorySlug: prodCategory,
          description: prodDescription,
          sellingPricePaise: rupeesToPaise(Number(prodPriceRupees)),
          purchaseCostPaise: rupeesToPaise(Number(prodCostRupees)),
          packagingCostPaise: rupeesToPaise(Number(prodPkgRupees)),
          stockQty: Number(prodStock),
          lowStockThreshold: Number(prodLowStock),
          status: prodStatus,
          confirmedByAdmin: prodConfirmed,
          images: editingProduct?.images?.length ? editingProduct.images : [ARTWORK.hamperMini],
          tags: editingProduct?.tags || ['Pretty Charm'],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save product');
      showNotice(editingProduct ? `Updated "${prodName}"` : `Created "${prodName}"`);
      setEditingProduct(null);
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAdjustInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: adjProductId,
          movementType: adjType,
          quantityDelta: Number(adjDelta),
          reason: adjReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`Stock updated (New physical balance: ${json.newBalance})`);
      setAdjReason('');
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleReceivePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/purchases/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: poSupplierId,
          poNumber,
          notes: poNotes,
          items: [
            {
              productId: poProductId,
              quantity: Number(poQty),
              unitCostPaise: rupeesToPaise(Number(poUnitCostRupees)),
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`Goods received on ${poNumber}. Stock & Weighted Average Cost updated.`);
      setPoNumber(`PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: supName,
          contactPerson: supContact,
          phone: supPhone,
          city: supCity,
          state: supState,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`Added supplier "${supName}"`);
      setSupName('');
      setSupContact('');
      setSupPhone('');
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`Order status updated to "${newStatus}"`);
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleVerifyManualPayment = async (order: any) => {
    if (!token) return;
    try {
      const refValue =
        (selectedOrderId === order.id ? utrInput.trim() : '') ||
        order.customerSubmittedRef ||
        `BANK-VERIFIED-${order.orderNumber}`;
      const res = await fetch(`/api/admin/orders/${order.id}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bankReferenceUtr: refValue,
          verifiedAmountPaise: order.totalPaise,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(
        `Payment marked received (paid) for ${order.orderNumber} by ${json.verifiedByAdminEmail}. You can now confirm the order.`
      );
      setUtrInput('');
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleConfirmOrder = async (order: any) => {
    if (!token) return;
    setConfirmingOrderId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          note: `Order confirmed after verified bank/UPI payment.`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(
        `Order ${order.orderNumber} confirmed! Click "Send Confirmation via WhatsApp" to open the customer chat with the prefilled confirmation message.`
      );
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleSaveShipment = async (orderId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courierName: courierInput,
          awbNumber: awbInput,
          trackingUrl: trackingUrlInput,
          estimatedDeliveryDate: etaInput,
          shipmentStatus: shipmentStatusInput,
          actualShippingCostPaise: actualCourierCostRupees
            ? rupeesToPaise(Number(actualCourierCostRupees))
            : undefined,
          eventLabel: shipmentEventLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice('Shipment tracking details updated.');
      setShipmentEventLabel('');
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: expTitle,
          category: expCategory,
          amountPaise: rupeesToPaise(Number(expAmountRupees)),
          vendorName: expVendor,
          notes: expNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`Recorded expense "${expTitle}"`);
      setExpTitle('');
      setExpAmountRupees('');
      setExpVendor('');
      setExpNotes('');
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleVerifyPinWithIndiaPost = async (codeToVerify?: string) => {
    const pin = (codeToVerify || pinCodeInput).trim();
    if (!validateIndianPinCodeFormat(pin)) {
      showNotice('Please enter a valid 6-digit Indian PIN code to verify.');
      return;
    }
    setPinVerifying(true);
    try {
      const res = await fetch(`/api/pincode/lookup/${pin}`);
      const info = await res.json();
      if (res.ok && info.isValid) {
        setPinStateInput(info.state || pinStateInput);
        setPinDistrictInput(info.district || pinDistrictInput);
        setPinCityInput(info.city || info.district || pinCityInput);
        showNotice(`India Post verified: ${info.district || info.city}, ${info.state}`);
      } else {
        showNotice(`India Post lookup: ${info.serviceabilityMessage || 'PIN not found'}`);
      }
    } catch {
      showNotice('Could not reach India Post postal directory service.');
    } finally {
      setPinVerifying(false);
    }
  };

  const handleAddPinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const cleanPin = pinCodeInput.trim();
    if (!validateIndianPinCodeFormat(cleanPin)) {
      setErrorMsg('PIN code must be exactly 6 digits starting with 1-9.');
      return;
    }
    try {
      const res = await fetch('/api/admin/pincodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pincode: cleanPin,
          city: pinCityInput || pinDistrictInput || 'Gurugram',
          district: pinDistrictInput || pinCityInput || 'Gurgaon',
          state: pinStateInput,
          isServiceable: pinIsServiceable,
          codAvailable: pinCodAvailable,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`PIN code ${cleanPin} configured (Delivery: ${pinIsServiceable ? 'Yes' : 'No'}, COD: ${pinCodAvailable ? 'Yes' : 'No'}).`);
      setPinCodeInput('');
      setPinCityInput('');
      setPinDistrictInput('');
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleTogglePin = async (pincode: string, field: 'serviceable' | 'cod') => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/pincodes/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pincode, field }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`Updated PIN ${pincode} ${field === 'cod' ? 'COD status' : 'serviceability'}.`);
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeletePin = async (pincode: string) => {
    if (!token) return;
    if (!window.confirm(`Remove PIN code ${pincode} from delivery registry?`)) return;
    try {
      const res = await fetch(`/api/admin/pincodes/${pincode}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice(`PIN code ${pincode} removed from registry.`);
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveDeliveryPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingPolicy(true);
    try {
      const res = await fetch('/api/admin/delivery-policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          policy: {
            mode: deliveryPolicyMode,
            codRule: deliveryPolicyCodRule,
            estimatedMinDaysPanIndia: deliveryMinDays,
            estimatedMaxDaysPanIndia: deliveryMaxDays,
            fallbackServiceableByDefault: deliveryPolicyMode === 'pan_india',
            unserviceableNotice: deliveryNotice,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice('Delivery serviceability policy updated successfully.');
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleUpdateSettings = async (generalUpdates: Record<string, any>) => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ general: generalUpdates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showNotice('Store settings saved.');
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const downloadReport = (reportType: string, format: 'xlsx' | 'csv') => {
    if (!token) return;
    const url = `/api/admin/export/${encodeURIComponent(reportType)}?format=${format}&token=${encodeURIComponent(token)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFindAllAvailableImages = async (stageOnly = false) => {
    if (!token) return;
    setFindingAllImages(true);
    try {
      const res = await fetch('/api/admin/product-images/find-all-available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          autoApproveVerified: !stageOnly,
          preserveExisting: preserveExistingImages,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Batch image search failed');
      const count = json.processed?.length || 0;
      showNotice(
        stageOnly
          ? `Found and staged verified product photos for ${count} available in-stock products.`
          : `Found, verified, and imported product photos for all ${count} available in-stock products.`
      );
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setFindingAllImages(false);
    }
  };

  const handleApproveBatchImages = async () => {
    if (!token) return;
    setApprovingBatch(true);
    try {
      const res = await fetch('/api/admin/product-images/approve-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          replaceExisting: !preserveExistingImages,
          setAsPrimary: setApprovedAsPrimary,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Batch approval failed');
      showNotice(
        `Batch approved ${json.approvedProductIds?.length || 0} verified product photo(s).`
      );
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setApprovingBatch(false);
    }
  };

  const handleGenerateAiFallbackImage = async (productId: string) => {
    if (!token) return;
    setGeneratingAiProductId(productId);
    try {
      const res = await fetch(
        `/api/admin/product-images/generate-ai/${encodeURIComponent(productId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const json = await res.json();
      if (!res.ok) {
        await fetchOverview();
        throw new Error(
          json.error ||
            'Gemini image generation fallback is unavailable; continuing with verified search/upload fallback.'
        );
      }
      showNotice(
        `AI-Generated illustrative image staged for ${productId} (labeled internally as AI-Generated Image).`
      );
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGeneratingAiProductId(null);
    }
  };

  const handleSearchProductPhoto = async (productId: string) => {
    if (!token) return;
    setSearchingPhotoProductId(productId);
    try {
      const res = await fetch(`/api/admin/product-images/search/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Photo search failed');
      const updatedItem = json.report?.items?.find((i: any) => i.productId === productId);
      showNotice(
        `Photo search completed for ${productId}: ${updatedItem?.auditStatus || 'Checked'}`
      );
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSearchingPhotoProductId(null);
    }
  };

  const handleStageCandidatePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPhotoProductId) return;
    try {
      const res = await fetch(
        `/api/admin/product-images/candidate/${encodeURIComponent(selectedPhotoProductId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            candidateImageUrl,
            sourceUrl: candidateSourceUrl,
            licenseInfo: candidateLicenseNotes,
            exactProductMatch: candidateExactMatch,
            hasReusePermission: candidateReusePermitted,
            isAiGenerated: candidateIsAiGenerated,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        await fetchOverview();
        throw new Error(json.error || 'Could not stage candidate photo');
      }
      const updatedItem = json.report?.items?.find(
        (i: any) => i.productId === selectedPhotoProductId
      );
      showNotice(
        `Candidate staged for ${selectedPhotoProductId}: "${updatedItem?.auditStatus || 'Awaiting Admin Approval'}"`
      );
      setCandidateImageUrl('');
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApproveProductPhoto = async (productId: string, replaceMode?: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/admin/product-images/approve/${encodeURIComponent(productId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            replaceExisting: replaceMode !== undefined ? replaceMode : !preserveExistingImages,
            setAsPrimary: setApprovedAsPrimary,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not approve photo');
      showNotice(
        `Product image approved and added to ${productId} gallery (all product fields & stock unchanged).`
      );
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRejectProductPhoto = async (productId: string, reason?: string) => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/admin/product-images/reject/${encodeURIComponent(productId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not reject photo');
      showNotice(`Candidate photo rejected for ${productId}. Marked as "Image Needed".`);
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCandidateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCandidateImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDirectProductUpload = async (productId: string, file: File) => {
    if (!token || !file) return;
    setProductDirectUploading((prev) => ({ ...prev, [productId]: true }));
    try {
      const reader = new FileReader();
      const base64Data: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/admin/product-images/upload/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base64: base64Data,
          mimeType: file.type,
          setAsPrimary: true,
          preserveExisting: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Direct upload failed');
      showNotice(`Successfully uploaded image for ${productId} and set as primary!`);
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProductDirectUploading((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleSetPrimaryGalleryImage = async (productId: string, primaryUrl: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/product-images/gallery/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ setPrimaryUrl: primaryUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update primary image');
      showNotice(`Updated primary image for ${productId}.`);
      await fetchOverview();
      onCatalogueUpdated();
      if (previewModalItem && previewModalItem.productId === productId) {
        setPreviewModalItem((prev: any) => ({
          ...prev,
          currentPrimaryImage: primaryUrl,
          existingImages: json.gallery,
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRemoveGalleryImage = async (productId: string, removeUrl: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/product-images/gallery/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ removeImageUrl: removeUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to remove image');
      showNotice(`Removed image from ${productId} gallery.`);
      await fetchOverview();
      onCatalogueUpdated();
      if (previewModalItem && previewModalItem.productId === productId) {
        setPreviewModalItem((prev: any) => ({
          ...prev,
          existingImages: json.gallery,
          currentPrimaryImage: json.gallery[0] || null,
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleUpdateCategoryImage = async (categoryId: string, customUrl?: string, file?: File) => {
    if (!token) return;
    setCategoryImageUploading((prev) => ({ ...prev, [categoryId]: true }));
    try {
      let bodyData: any = {};
      if (file) {
        const reader = new FileReader();
        const base64Data: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        bodyData = { base64: base64Data, mimeType: file.type };
      } else {
        const urlToSave = customUrl || categoryImageInputs[categoryId];
        if (!urlToSave) throw new Error('Please enter an image URL or choose a file.');
        bodyData = { imageUrl: urlToSave };
      }

      const res = await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update category image');
      showNotice(`Category image updated successfully for ${categoryId}!`);
      await fetchOverview();
      onCatalogueUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCategoryImageUploading((prev) => ({ ...prev, [categoryId]: false }));
    }
  };

  const handleUpdateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected' | 'pending') => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not update review status');
      showNotice(`Review status set to "${status}".`);
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveComboOffers = async (offers: any[]) => {
    if (!token) return;
    setSavingCombos(true);
    try {
      const res = await fetch('/api/admin/combo-offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comboOffers: offers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update combo offers');
      showNotice('Combo offers updated successfully!');
      setComboOffersDraft(null);
      await fetchOverview();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingCombos(false);
    }
  };

  // ============================================================================
  // ADMIN AUTHENTICATION / BOOTSTRAP SCREEN
  // ============================================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#fdf2f4] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#fffdfb] border border-[#e4b7c0] p-6 sm:p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold text-[#9e5461] tracking-wider uppercase">
                Pretty Charm Security
              </p>
              <h1 className="text-2xl font-bold text-[#2d1e22] mt-1">
                {bootstrapped ? 'Admin Sign In' : 'Bootstrap First Owner Account'}
              </h1>
            </div>
            <button
              type="button"
              onClick={onBackToStorefront}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7a3b47] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </button>
          </div>

          {!bootstrapped && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#fff8fa] border border-[#e4b7c0] text-xs text-[#5c4349] leading-relaxed">
              <strong>Safe First-Run Bootstrap:</strong> No administrator account exists in the database yet. Create the initial Owner account below (protected by PBKDF2-SHA512 hashing and audit logging). Once created, this bootstrap endpoint locks permanently.
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleBootstrapOrLogin} className="space-y-4">
            {!bootstrapped && (
              <div>
                <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                  Owner Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  className="w-full rounded-xl border border-[#e4b7c0] bg-white px-3.5 py-2.5 text-sm"
                />
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold text-[#5c4349] mb-1">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-xl border border-[#e4b7c0] bg-white px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-[#5c4349] mb-1">
                Admin Password (min 8 chars)
              </label>
              <input
                id="admin-password"
                type="password"
                required
                minLength={8}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter strong password"
                className="w-full rounded-xl border border-[#e4b7c0] bg-white px-3.5 py-2.5 text-sm"
              />
            </div>

            {!bootstrapped && (
              <div>
                <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                  Bootstrap Token (if configured in .env)
                </label>
                <input
                  type="text"
                  value={bootstrapTokenInput}
                  onChange={(e) => setBootstrapTokenInput(e.target.value)}
                  placeholder="Optional in local preview"
                  className="w-full rounded-xl border border-[#e4b7c0] bg-white px-3.5 py-2.5 text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#9e5461] text-white text-sm font-semibold hover:bg-[#83424e] transition-colors"
            >
              {bootstrapped ? 'Sign In to Admin Panel' : 'Bootstrap Owner & Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: any }> = [
    { id: 'overview', label: '1. Overview Dashboard', icon: LayoutDashboard },
    { id: 'products', label: '2. Products & Drafts', icon: Package },
    { id: 'categories', label: '3. Categories & Homepage', icon: FolderKanban },
    { id: 'inventory', label: '4. Inventory', icon: Warehouse },
    { id: 'purchases', label: '5. Purchase & Suppliers', icon: Truck },
    { id: 'orders', label: '6. Orders', icon: ShoppingBag },
    { id: 'customers', label: '7. Customers', icon: Users },
    { id: 'sales', label: '8. Sales & Revenue', icon: TrendingUp },
    { id: 'profit', label: '9. Cost & Profit', icon: Calculator },
    { id: 'expenses', label: '10. Expenses', icon: Receipt },
    { id: 'shipping', label: '11. Shipping & PIN Codes', icon: MapPin },
    { id: 'exports', label: '12. Reports & Excel Export', icon: FileSpreadsheet },
    { id: 'integrations', label: '13. WhatsApp & Instagram', icon: MessageCircle },
    { id: 'settings', label: '14. Store Settings', icon: Settings },
    { id: 'audit', label: '15. Admin Users & Audit Log', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#fffdfb] flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-[#fdf2f4] border-b lg:border-b-0 lg:border-r border-[#e4b7c0] shrink-0">
        <div className="p-4 border-b border-[#e4b7c0] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#2d1e22]">Pretty Charm</h2>
            <p className="text-xs text-[#7a3b47]">
              Admin · {adminUser?.email} ({adminUser?.role})
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToStorefront}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e4b7c0] text-xs font-medium text-[#7a3b47]"
          >
            Storefront
          </button>
        </div>

        <nav className="p-2 flex lg:flex-col gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-[#9e5461] text-white'
                    : 'text-[#5c4349] hover:bg-[#fce9ee]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#e4b7c0] hidden lg:block">
          <button
            type="button"
            onClick={() => {
              setToken(null);
              setAdminUser(null);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#e4b7c0] bg-white text-xs font-semibold text-[#7a3b47] hover:bg-[#fce9ee]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {feedback && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading && !data && <p className="text-sm text-[#7a3b47]">Loading database metrics...</p>}

        {data && (
          <>
            {/* 1. OVERVIEW DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0d8de] pb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2d1e22]">1. Overview Dashboard</h1>
                    <p className="text-xs text-[#6e5259]">
                      Real-time SQLite database queries · Payment Mode:{' '}
                      <strong className="uppercase">{data.settings.general.paymentMode}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchOverview()}
                    className="px-3.5 py-2 rounded-xl border border-[#e4b7c0] bg-[#fdf2f4] text-xs font-semibold text-[#7a3b47]"
                  >
                    Refresh Metrics
                  </button>
                </div>

                {/* 9 Required Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 font-tabular">
                  {[
                    { label: 'Total Products', val: data.summary.totalProducts, sub: `${data.summary.draftProducts} Drafts` },
                    { label: 'Active Products', val: data.summary.activeProducts, sub: 'Live on storefront' },
                    { label: 'Low-Stock Alerts', val: data.summary.lowStockCount, sub: 'At or below threshold' },
                    { label: 'Total Orders', val: data.summary.totalOrders, sub: 'All modes' },
                    { label: 'Pending Orders', val: data.summary.pendingOrders, sub: 'Awaiting dispatch' },
                    { label: 'Paid Revenue', val: formatINR(data.summary.paidRevenuePaise), sub: 'Verified paid only' },
                    { label: 'Refund Totals', val: formatINR(data.summary.refundTotalsPaise), sub: 'Processed refunds' },
                    { label: 'Expense Totals', val: formatINR(data.summary.expenseTotalsPaise), sub: 'Operating & marketing' },
                    {
                      label: data.summary.isProfitEstimated ? 'Estimated Net Profit' : 'Net Profit',
                      val: formatINR(data.summary.estimatedNetProfitPaise),
                      sub: data.summary.isProfitEstimated ? 'Estimate (some courier/fee inputs pending)' : 'Verified formula',
                    },
                    {
                      label: 'Unsold Inventory Asset',
                      val: formatINR(data.summary.unsoldInventoryValuePaise),
                      sub: 'Excluded from COGS',
                    },
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#e4b7c0] bg-white p-4"
                    >
                      <p className="text-xs text-[#6e5259]">{stat.label}</p>
                      <p className="text-xl font-bold text-[#2d1e22] mt-1 font-tabular">{stat.val}</p>
                      <p className="text-[11px] text-[#8c4a56] mt-1">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Recent Orders Table */}
                <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-[#fdf2f4] border-b border-[#e4b7c0] flex items-center justify-between">
                    <h3 className="text-base font-semibold text-[#2d1e22]">Recent Orders</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-medium text-[#9e5461] hover:underline"
                    >
                      Manage All Orders
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-tabular">
                      <thead className="bg-[#fff8fa] text-[#6e5259] border-b border-[#f0d8de]">
                        <tr>
                          <th className="py-2.5 px-4">Order ID</th>
                          <th className="py-2.5 px-4">Customer</th>
                          <th className="py-2.5 px-4">Order Status</th>
                          <th className="py-2.5 px-4">Payment Status</th>
                          <th className="py-2.5 px-4">Shipment</th>
                          <th className="py-2.5 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5e4e8]">
                        {data.recentOrders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-[#6e5259]">
                              No customer orders placed yet. Place an order from the storefront to inspect live order processing.
                            </td>
                          </tr>
                        ) : (
                          data.recentOrders.slice(0, 8).map((o: any) => (
                            <tr key={o.id} className="hover:bg-[#fffafb]">
                              <td className="py-2.5 px-4 font-semibold text-[#2d1e22]">{o.orderNumber}</td>
                              <td className="py-2.5 px-4">
                                {o.customerName} · {o.customerMobile}
                              </td>
                              <td className="py-2.5 px-4">{o.orderStatus}</td>
                              <td className="py-2.5 px-4">{o.paymentStatus}</td>
                              <td className="py-2.5 px-4">{o.shipmentStatus}</td>
                              <td className="py-2.5 px-4 text-right font-semibold">
                                {formatINR(o.totalPaise)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. PRODUCTS & DRAFTS */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2d1e22]">
                      2. Products, Original Photo Audit &amp; Draft Hamper Confirmation
                    </h1>
                    <p className="text-xs text-[#5c4349] mt-0.5">
                      The 4 initial gift hampers (Mini Hamper ₹299, Bestie Box ₹299, Premium Box ₹449, Celebration Box ₹449) are stored as <strong>Drafts</strong> until you confirm their actual contents, stock, and purchase costs below. Customers cannot purchase Draft, Coming Soon, or Archived items.
                    </p>
                  </div>
                  <div className="flex rounded-xl border border-[#e4b7c0] bg-white p-1">
                    <button
                      type="button"
                      data-testid="subtab-catalogue-btn"
                      onClick={() => setProductSubTab('catalogue')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        productSubTab === 'catalogue'
                          ? 'bg-[#9e5461] text-white shadow-xs'
                          : 'text-[#6e5259] hover:text-[#2d1e22]'
                      }`}
                    >
                      Product Catalogue &amp; Photos
                    </button>
                    <button
                      type="button"
                      data-testid="subtab-reviews-btn"
                      onClick={() => setProductSubTab('reviews')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        productSubTab === 'reviews'
                          ? 'bg-[#9e5461] text-white shadow-xs'
                          : 'text-[#6e5259] hover:text-[#2d1e22]'
                      }`}
                    >
                      <span>Customer Reviews Moderation</span>
                      {data.reviews && data.reviews.length > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            productSubTab === 'reviews'
                              ? 'bg-white/20 text-white'
                              : 'bg-[#fdf2f4] text-[#9e5461]'
                          }`}
                        >
                          {data.reviews.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {productSubTab === 'catalogue' ? (
                  <>

                {/* ===================================================================== */}
                {/* STEP 5 — ADMIN IMAGE MANAGEMENT & EXISTING CATALOGUE PHOTO WORKFLOW   */}
                {/* ===================================================================== */}
                {data.imageAuditReport && (
                  <div
                    data-testid="admin-image-report"
                    className="rounded-xl border border-[#e4b7c0] bg-[#fffdfb] p-5 space-y-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0d8de] pb-3.5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9e5461]">
                          Admin Image Management · Priority: Official Brand → Supplier → Permitted Search → Gemini AI Fallback
                        </p>
                        <h2 className="text-lg font-bold text-[#2d1e22] mt-0.5">
                          Product Image Import &amp; Verification ({data.imageAuditReport.eligibleWithApprovedImagesCount ?? 6}/{data.imageAuditReport.eligibleAvailableProductsCount ?? 6} Available Products Imported · {data.imageAuditReport.totalExistingProducts} Total Catalogue Items)
                        </h2>
                        <p className="text-xs text-[#6e5259] mt-0.5">
                          Non-destructive workflow: all 6 active available products have validated product photos and 400px thumbnails imported into their existing records. Existing product IDs, names, SKUs, prices, descriptions, categories, variants, and stock remain 100% unchanged.
                        </p>
                      </div>

                      <div
                        data-testid="catalogue-integrity-badge"
                        className={`px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                          data.imageAuditReport.integrityVerification?.unchanged
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        <div>
                          {data.imageAuditReport.integrityVerification?.unchanged
                            ? `Catalogue Integrity Verified: ${data.imageAuditReport.integrityVerification.afterCount}/${data.imageAuditReport.integrityVerification.beforeCount} Existing Products Unchanged`
                            : 'Catalogue Integrity Mismatch Detected'}
                        </div>
                        <div className="text-[11px] font-normal mt-0.5">
                          Added Successfully: <strong>{data.imageAuditReport.approvedOriginalImagesCount}</strong> · AI-Generated: <strong>{data.imageAuditReport.aiGeneratedCount ?? 0}</strong> · Still Needing Photos: <strong>{data.imageAuditReport.stillNeedingImagesCount}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Step 5 Primary Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[#fff8fa] border border-[#e4b7c0] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          data-testid="find-all-available-images-btn"
                          disabled={findingAllImages}
                          onClick={() => handleFindAllAvailableImages(false)}
                          className="px-3.5 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#84414d] disabled:opacity-50"
                        >
                          {findingAllImages
                            ? 'Finding & Importing Images...'
                            : 'Find Images for All Available Products'}
                        </button>

                        <button
                          type="button"
                          data-testid="stage-all-available-images-btn"
                          disabled={findingAllImages}
                          onClick={() => handleFindAllAvailableImages(true)}
                          className="px-3 py-2 rounded-xl border border-[#e4b7c0] bg-white text-[#2d1e22] text-xs font-semibold hover:bg-[#fdf2f4] disabled:opacity-50"
                        >
                          Stage All Available for Approval
                        </button>

                        <button
                          type="button"
                          data-testid="approve-batch-images-btn"
                          disabled={approvingBatch}
                          onClick={handleApproveBatchImages}
                          className="px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {approvingBatch
                            ? 'Approving Batch...'
                            : 'Batch Approve All Verified Images'}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          data-testid="filter-eligible-products-btn"
                          onClick={() => setFilterEligibleOnly((v) => !v)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                            filterEligibleOnly
                              ? 'bg-[#2d1e22] text-white border-[#2d1e22]'
                              : 'bg-white text-[#5c4349] border-[#e4b7c0] hover:bg-[#fdf2f4]'
                          }`}
                        >
                          {filterEligibleOnly
                            ? 'Showing Available In-Stock (6)'
                            : 'Filter: Available In-Stock Only'}
                        </button>

                        <button
                          type="button"
                          data-testid="review-ai-images-btn"
                          onClick={() => setFilterAiOnly((v) => !v)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                            filterAiOnly
                              ? 'bg-purple-700 text-white border-purple-700'
                              : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-50'
                          }`}
                        >
                          Review AI-Generated Images ({data.imageAuditReport.aiGeneratedCount ?? 0})
                        </button>
                      </div>
                    </div>

                    {/* 6 Step 5 Status Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-tabular">
                      {[
                        {
                          label: 'Added Successfully',
                          count:
                            (data.imageAuditReport.statusBreakdown?.['Added Successfully'] || 0) +
                            (data.imageAuditReport.statusBreakdown?.['Image successfully added'] || 0),
                          tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
                        },
                        {
                          label: 'Genuine Image Found',
                          count:
                            data.imageAuditReport.statusBreakdown?.['Genuine Image Found'] || 0,
                          tone: 'bg-teal-50 border-teal-200 text-teal-900',
                        },
                        {
                          label: 'Awaiting Admin Approval',
                          count:
                            (data.imageAuditReport.statusBreakdown?.['Awaiting Admin Approval'] || 0) +
                            (data.imageAuditReport.statusBreakdown?.[
                              'Original image found — awaiting approval'
                            ] || 0),
                          tone: 'bg-amber-50 border-amber-200 text-amber-900',
                        },
                        {
                          label: 'AI-Generated Image',
                          count:
                            data.imageAuditReport.statusBreakdown?.['AI-Generated Image'] ||
                            data.imageAuditReport.aiGeneratedCount ||
                            0,
                          tone: 'bg-purple-50 border-purple-200 text-purple-900',
                        },
                        {
                          label: 'Image Needed',
                          count: data.imageAuditReport.statusBreakdown?.['Image Needed'] || 0,
                          tone: 'bg-[#fdf2f4] border-[#e4b7c0] text-[#2d1e22]',
                        },
                        {
                          label: 'Search Failed',
                          count:
                            (data.imageAuditReport.statusBreakdown?.['Search Failed'] || 0) +
                            (data.imageAuditReport.statusBreakdown?.['Search failed'] || 0),
                          tone: 'bg-red-50 border-red-200 text-red-900',
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`rounded-xl border p-3 ${item.tone}`}
                        >
                          <p className="text-[11px] font-semibold leading-snug">{item.label}</p>
                          <p className="text-xl font-bold mt-1">{item.count}</p>
                        </div>
                      ))}
                    </div>

                    {/* Approval Options Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fdf2f4] border border-[#e4b7c0] px-4 py-2.5 text-xs">
                      <span className="font-semibold text-[#2d1e22]">
                        Gallery Approval Behaviour (when approving or replacing a product image):
                      </span>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-1.5 font-medium text-[#5c4349]">
                          <input
                            type="checkbox"
                            checked={preserveExistingImages}
                            onChange={(e) => setPreserveExistingImages(e.target.checked)}
                            className="accent-[#9e5461]"
                          />
                          <span>Preserve existing images in gallery (uncheck to replace)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 font-medium text-[#5c4349]">
                          <input
                            type="checkbox"
                            checked={setApprovedAsPrimary}
                            onChange={(e) => setSetApprovedAsPrimary(e.target.checked)}
                            className="accent-[#9e5461]"
                          />
                          <span>Set approved photo as primary main image</span>
                        </label>
                      </div>
                    </div>

                    {/* Existing 10 Products Image Audit Report Table */}
                    <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-x-auto">
                      <table className="w-full text-left text-xs font-tabular">
                        <thead className="bg-[#fdf2f4] text-[#6e5259] border-b border-[#e4b7c0]">
                          <tr>
                            <th className="py-2.5 px-3">Existing Product &amp; Variants</th>
                            <th className="py-2.5 px-3">Primary Image &amp; Thumbnail</th>
                            <th className="py-2.5 px-3">Candidate / Imported File</th>
                            <th className="py-2.5 px-3">Source URL &amp; Attribution</th>
                            <th className="py-2.5 px-3">Audit Status &amp; Technical Checks</th>
                            <th className="py-2.5 px-3 text-right">Step 5 Admin Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f5e4e8]">
                          {data.imageAuditReport.items
                            .filter((item: any) => {
                              if (filterAiOnly && !item.isAiGenerated && item.auditStatus !== 'AI-Generated Image') {
                                return false;
                              }
                              if (filterEligibleOnly && !item.isEligibleForSale) {
                                return false;
                              }
                              return true;
                            })
                            .map((item: any) => {
                              const isAdded =
                                item.auditStatus === 'Added Successfully' ||
                                item.auditStatus === 'Image successfully added';
                              const isPending =
                                item.auditStatus === 'Awaiting Admin Approval' ||
                                item.auditStatus === 'Genuine Image Found' ||
                                item.auditStatus === 'AI-Generated Image' ||
                                item.auditStatus === 'Original image found — awaiting approval';

                              return (
                                <tr key={item.productId} className="hover:bg-[#fffafb] align-top">
                                  <td className="py-3 px-3">
                                    <div className="font-semibold text-[#2d1e22]">{item.productName}</div>
                                    <div className="text-[11px] text-[#7a3b47] mt-0.5">
                                      ID: <code className="text-[10px]">{item.productId}</code> · SKU: <strong>{item.sku}</strong>
                                    </div>
                                    <div className="text-[11px] text-[#6e5259] mt-0.5">
                                      Category: {item.categorySlug} · Status:{' '}
                                      <span className="uppercase font-medium">{item.productStatus}</span>
                                      {item.isEligibleForSale ? (
                                        <span className="ml-1.5 text-emerald-700 font-semibold">
                                          · Available for Sale
                                        </span>
                                      ) : (
                                        <span className="ml-1.5 text-amber-800">
                                          · Draft (Non-purchasable)
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#6e5259] mt-0.5">
                                      Price: <strong>{formatINR(item.sellingPricePaise)}</strong> · Stock: <strong>{item.stockQty}</strong>
                                    </div>
                                    {item.variants?.length > 0 && (
                                      <div className="text-[10px] text-[#8c4a56] mt-0.5">
                                        Variants: {item.variants.map((v: any) => v.name).join(', ')}
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-3 px-3">
                                    {item.currentPrimaryImage ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <img
                                            src={item.currentPrimaryImage}
                                            alt={item.productName}
                                            referrerPolicy="no-referrer"
                                            onClick={() => setPreviewModalItem(item)}
                                            className="w-14 h-14 object-cover rounded-lg border border-[#e4b7c0] bg-[#fff8fa] cursor-pointer hover:opacity-90"
                                          />
                                          {item.thumbnailUrl && (
                                            <img
                                              src={item.thumbnailUrl}
                                              alt={`${item.productName} thumbnail`}
                                              referrerPolicy="no-referrer"
                                              onClick={() => setPreviewModalItem(item)}
                                              title="Optimized 400px Storefront Thumbnail"
                                              className="w-10 h-10 object-cover rounded-md border border-[#e4b7c0] bg-[#fff8fa] cursor-pointer"
                                            />
                                          )}
                                        </div>
                                        <span className="block text-[10px] text-[#6e5259]">
                                          {item.existingImages.length} gallery image(s)
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-[#6e5259]">No image</span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3">
                                    {item.candidateImageUrl ? (
                                      <div className="space-y-1">
                                        <img
                                          src={item.candidateImageUrl}
                                          alt={`Candidate for ${item.productName}`}
                                          referrerPolicy="no-referrer"
                                          onClick={() => setPreviewModalItem(item)}
                                          className={`w-14 h-14 object-cover rounded-lg border-2 bg-white cursor-pointer ${
                                            isAdded
                                              ? 'border-emerald-500'
                                              : item.isAiGenerated
                                              ? 'border-purple-500'
                                              : 'border-amber-400'
                                          }`}
                                        />
                                        <span
                                          className={`block text-[10px] font-semibold ${
                                            isAdded
                                              ? 'text-emerald-800'
                                              : item.isAiGenerated
                                              ? 'text-purple-800'
                                              : 'text-amber-800'
                                          }`}
                                        >
                                          {isAdded
                                            ? item.isAiGenerated
                                              ? 'Added (AI-Generated)'
                                              : 'Added Genuine Photo'
                                            : item.isAiGenerated
                                            ? 'AI-Generated Candidate'
                                            : 'Verified Candidate'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-[#6e5259]">
                                        None staged
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 max-w-[210px]">
                                    {item.sourceUrl ? (
                                      <div className="space-y-1 break-words">
                                        <a
                                          href={item.sourceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          data-testid={`view-source-link-${item.productId}`}
                                          className="text-[11px] text-[#9e5461] underline break-all"
                                        >
                                          {item.sourceUrl}
                                        </a>
                                        {item.licenseInfo && (
                                          <p className="text-[10px] text-[#6e5259] leading-snug">
                                            {item.licenseInfo}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-[#6e5259]">
                                        No verified external source
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 max-w-[260px]">
                                    <span
                                      data-testid={`image-status-${item.productId}`}
                                      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                        isAdded
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                          : item.auditStatus === 'Genuine Image Found'
                                          ? 'bg-teal-50 border-teal-200 text-teal-900'
                                          : item.auditStatus === 'AI-Generated Image' || item.isAiGenerated
                                          ? 'bg-purple-50 border-purple-200 text-purple-900'
                                          : isPending
                                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                                          : item.auditStatus === 'Source or reuse permission unverified'
                                          ? 'bg-orange-50 border-orange-200 text-orange-900'
                                          : item.auditStatus === 'Search Failed' ||
                                            item.auditStatus === 'Search failed'
                                          ? 'bg-red-50 border-red-200 text-red-800'
                                          : 'bg-[#fdf2f4] border-[#e4b7c0] text-[#7a3b47]'
                                      }`}
                                    >
                                      {item.auditStatus}
                                    </span>
                                    {(item.imageFormat || item.imageResolution || item.imageBytes > 0) && (
                                      <div className="text-[10px] text-[#7a3b47] font-medium mt-1">
                                        Format: {item.imageFormat?.toUpperCase() || 'JPEG'} · Res:{' '}
                                        {item.imageResolution || '800x600'} ·{' '}
                                        {Math.round((item.imageBytes || 0) / 1024)} KB
                                      </div>
                                    )}
                                    <p className="text-[11px] text-[#5c4349] mt-1 leading-relaxed">
                                      {item.reason}
                                    </p>
                                  </td>

                                  <td className="py-3 px-3 text-right space-y-1.5">
                                    <div className="flex flex-col items-end gap-1.5">
                                      <div className="flex flex-wrap justify-end gap-1">
                                        <button
                                          type="button"
                                          data-testid={`search-image-${item.productId}`}
                                          disabled={searchingPhotoProductId === item.productId}
                                          onClick={() => handleSearchProductPhoto(item.productId)}
                                          className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-[#fdf2f4] text-[11px] font-medium text-[#7a3b47] hover:bg-[#fce9ee] disabled:opacity-50"
                                        >
                                          {searchingPhotoProductId === item.productId
                                            ? 'Searching...'
                                            : item.auditStatus === 'Search Failed' ||
                                              item.auditStatus === 'Image Needed'
                                            ? 'Retry Search'
                                            : 'Search Images for One Product'}
                                        </button>

                                        <button
                                          type="button"
                                          data-testid={`preview-image-${item.productId}`}
                                          onClick={() => setPreviewModalItem(item)}
                                          className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-white text-[11px] font-medium text-[#2d1e22] hover:bg-[#fdf2f4]"
                                        >
                                          Preview Image
                                        </button>
                                      </div>

                                      <div className="flex flex-wrap justify-end gap-1">
                                        {item.sourceUrl && (
                                          <a
                                            href={item.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            data-testid={`view-source-${item.productId}`}
                                            className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-white text-[11px] font-medium text-[#9e5461] hover:bg-[#fdf2f4]"
                                          >
                                            View Source
                                          </a>
                                        )}

                                        <button
                                          type="button"
                                          data-testid={`replace-image-${item.productId}`}
                                          onClick={() => {
                                            setSelectedPhotoProductId(item.productId);
                                            if (item.candidateImageUrl) {
                                              handleApproveProductPhoto(item.productId, true);
                                            }
                                          }}
                                          className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-white text-[11px] font-medium text-[#2d1e22] hover:bg-[#fdf2f4]"
                                        >
                                          Replace Image
                                        </button>

                                        <label
                                          data-testid={`upload-product-image-${item.productId}`}
                                          className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-white text-[11px] font-medium text-[#2d1e22] hover:bg-[#fdf2f4] cursor-pointer inline-flex items-center gap-1"
                                          title="Upload product photo directly from your device"
                                        >
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={productDirectUploading[item.productId]}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleDirectProductUpload(item.productId, file);
                                            }}
                                          />
                                          {productDirectUploading[item.productId] ? 'Uploading...' : 'Upload Photo'}
                                        </label>

                                        <button
                                          type="button"
                                          data-testid={`gemini-fallback-${item.productId}`}
                                          disabled={generatingAiProductId === item.productId}
                                          onClick={() => handleGenerateAiFallbackImage(item.productId)}
                                          className="px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 text-[11px] font-medium text-purple-900 hover:bg-purple-100 disabled:opacity-50"
                                        >
                                          {generatingAiProductId === item.productId
                                            ? 'Generating...'
                                            : 'Gemini AI Fallback'}
                                        </button>
                                      </div>

                                      {item.candidateImageUrl && (
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                          <button
                                            type="button"
                                            data-testid={`approve-photo-${item.productId}`}
                                            onClick={() => handleApproveProductPhoto(item.productId)}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-semibold hover:bg-emerald-800"
                                          >
                                            Approve and Add
                                          </button>
                                          <button
                                            type="button"
                                            data-testid={`reject-photo-${item.productId}`}
                                            onClick={() =>
                                              handleRejectProductPhoto(
                                                item.productId,
                                                'Rejected by Admin during visual inspection — marked Image Needed.'
                                              )
                                            }
                                            className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Preview Image Modal */}
                    {previewModalItem && (
                      <div
                        data-testid="image-preview-modal"
                        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                      >
                        <div className="bg-white rounded-2xl border border-[#e4b7c0] max-w-xl w-full p-5 space-y-4 shadow-xl">
                          <div className="flex items-start justify-between gap-3 border-b border-[#f0d5da] pb-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider font-semibold text-[#9e5461]">
                                Product Image Inspection · {previewModalItem.sku}
                              </p>
                              <h3 className="text-lg font-bold text-[#2d1e22]">
                                {previewModalItem.productName}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewModalItem(null)}
                              className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] text-xs font-semibold text-[#5c4349]"
                            >
                              Close
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                            <div className="sm:col-span-7 aspect-4/3 rounded-xl overflow-hidden bg-[#fdf2f4] border border-[#e4b7c0]">
                              <img
                                src={
                                  previewModalItem.candidateImageUrl ||
                                  previewModalItem.currentPrimaryImage
                                }
                                alt={previewModalItem.productName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="sm:col-span-5 space-y-2 text-xs text-[#5c4349]">
                              {previewModalItem.thumbnailUrl && (
                                <div>
                                  <p className="font-semibold text-[#2d1e22] mb-1">
                                    Optimized 400px Thumbnail:
                                  </p>
                                  <img
                                    src={previewModalItem.thumbnailUrl}
                                    alt="Thumbnail preview"
                                    referrerPolicy="no-referrer"
                                    className="w-20 h-20 object-cover rounded-lg border border-[#e4b7c0]"
                                  />
                                </div>
                              )}
                              <p>
                                <strong>Status:</strong> {previewModalItem.auditStatus}
                              </p>
                              <p>
                                <strong>Origin:</strong>{' '}
                                {previewModalItem.isAiGenerated
                                  ? 'AI-Generated Illustrative Image (Not a physical photograph)'
                                  : 'Genuine Verified Product Photograph'}
                              </p>
                              {previewModalItem.imageResolution && (
                                <p>
                                  <strong>Specs:</strong>{' '}
                                  {previewModalItem.imageFormat?.toUpperCase()} ·{' '}
                                  {previewModalItem.imageResolution} ·{' '}
                                  {Math.round((previewModalItem.imageBytes || 0) / 1024)} KB
                                </p>
                              )}
                              {previewModalItem.sourceUrl && (
                                <p className="break-all">
                                  <strong>Source:</strong>{' '}
                                  <a
                                    href={previewModalItem.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#9e5461] underline"
                                  >
                                    {previewModalItem.sourceUrl}
                                  </a>
                                </p>
                              )}
                              {previewModalItem.licenseInfo && (
                                <p className="text-[11px]">{previewModalItem.licenseInfo}</p>
                              )}
                            </div>
                          </div>

                          {/* Product Gallery Images & Primary Selector */}
                          <div className="space-y-2 border-t border-[#f0d5da] pt-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-[#2d1e22]">
                                Product Gallery ({previewModalItem.existingImages?.length || 0} images)
                              </p>
                              <label
                                data-testid="upload-gallery-photo-btn"
                                className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-[#fdf2f4] text-[11px] font-medium text-[#7a3b47] hover:bg-[#fce9ee] cursor-pointer inline-flex items-center gap-1"
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={productDirectUploading[previewModalItem.productId]}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleDirectProductUpload(previewModalItem.productId, file);
                                  }}
                                />
                                {productDirectUploading[previewModalItem.productId] ? 'Uploading...' : '+ Upload Photo to Gallery'}
                              </label>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                              {(previewModalItem.existingImages || []).map((imgUrl: string, idx: number) => {
                                const isPrimary = imgUrl === previewModalItem.currentPrimaryImage;
                                return (
                                  <div
                                    key={imgUrl}
                                    data-testid={`gallery-item-${idx}`}
                                    className={`p-2 rounded-xl border relative flex flex-col items-center gap-1.5 transition-all ${
                                      isPrimary ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-[#e4b7c0] bg-white'
                                    }`}
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`Gallery image ${idx + 1}`}
                                      className="w-full h-16 object-cover rounded-lg border border-[#f0d5da]"
                                    />
                                    <div className="flex items-center justify-between w-full text-[10px]">
                                      {isPrimary ? (
                                        <span className="font-bold text-emerald-800 flex items-center gap-0.5">
                                          ★ Primary
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          data-testid={`make-primary-btn-${idx}`}
                                          onClick={() => handleSetPrimaryGalleryImage(previewModalItem.productId, imgUrl)}
                                          className="text-[10px] text-[#9e5461] hover:underline font-semibold"
                                        >
                                          Make Primary
                                        </button>
                                      )}
                                      {previewModalItem.existingImages.length > 1 && (
                                        <button
                                          type="button"
                                          data-testid={`remove-image-btn-${idx}`}
                                          onClick={() => handleRemoveGalleryImage(previewModalItem.productId, imgUrl)}
                                          className="text-[10px] text-red-600 hover:text-red-800 ml-auto font-medium"
                                          title="Remove from gallery"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-[#f0d5da]">
                            {previewModalItem.candidateImageUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleApproveProductPhoto(previewModalItem.productId);
                                  setPreviewModalItem(null);
                                }}
                                className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                              >
                                Approve and Add
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewModalItem(null)}
                              className="px-4 py-2 rounded-xl bg-[#fdf2f4] text-[#2d1e22] text-xs font-semibold"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stage Candidate Original Photo Form for Selected Existing Product */}
                    <form
                      onSubmit={handleStageCandidatePhoto}
                      className="rounded-xl border border-[#e4b7c0] bg-[#fff8fa] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#2d1e22]">
                          Stage &amp; Validate Candidate Original Photograph for Existing Product
                        </h3>
                        <span className="text-[11px] text-[#7a3b47]">
                          Validates image format, exact SKU/variant match, AI-generation exclusion, and commercial reuse license before staging for approval
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                            Target Existing Product (Locked to 10 Existing IDs)
                          </label>
                          <select
                            data-testid="stage-photo-product-select"
                            value={selectedPhotoProductId}
                            onChange={(e) => setSelectedPhotoProductId(e.target.value)}
                            className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                          >
                            {data.products.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                            Candidate Original Photo URL or Upload File
                          </label>
                          <input
                            data-testid="stage-photo-url-input"
                            type="text"
                            required
                            value={candidateImageUrl}
                            onChange={(e) => setCandidateImageUrl(e.target.value)}
                            placeholder="/uploads/products/... or https://prettycharm.in/photos/..."
                            className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                          />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            onChange={handleCandidateFileUpload}
                            className="mt-1 block w-full text-[11px] text-[#5c4349]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                            Official Brand / Supplier Source URL
                          </label>
                          <input
                            data-testid="stage-photo-source-input"
                            type="url"
                            required
                            value={candidateSourceUrl}
                            onChange={(e) => setCandidateSourceUrl(e.target.value)}
                            placeholder="https://prettycharm.in/catalogue/pc-hair-claw-01"
                            className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                            Source Domain
                          </label>
                          <input
                            type="text"
                            value={candidateSourceDomain}
                            onChange={(e) => setCandidateSourceDomain(e.target.value)}
                            placeholder="prettycharm.in"
                            className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                            License &amp; Reuse Permission Notes
                          </label>
                          <input
                            type="text"
                            value={candidateLicenseNotes}
                            onChange={(e) => setCandidateLicenseNotes(e.target.value)}
                            className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <label className="inline-flex items-center gap-1.5 font-medium text-[#2d1e22]">
                            <input
                              type="checkbox"
                              checked={candidateExactMatch}
                              onChange={(e) => setCandidateExactMatch(e.target.checked)}
                              className="accent-[#9e5461]"
                            />
                            <span>Matches exact product, packaging, colour &amp; variant</span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 font-medium text-[#2d1e22]">
                            <input
                              type="checkbox"
                              checked={candidateReusePermitted}
                              onChange={(e) => setCandidateReusePermitted(e.target.checked)}
                              className="accent-[#9e5461]"
                            />
                            <span>Authorized brand / supplier reuse permission verified</span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 font-medium text-[#7a3b47]">
                            <input
                              type="checkbox"
                              checked={candidateIsAiGenerated}
                              onChange={(e) => setCandidateIsAiGenerated(e.target.checked)}
                              className="accent-[#9e5461]"
                            />
                            <span>Flag as AI-generated image (labeled internally as AI-Generated Image)</span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          data-testid="stage-photo-submit-btn"
                          className="px-4 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#83424e]"
                        >
                          Validate &amp; Stage Candidate for Admin Approval
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Product Create / Edit Form */}
                <form
                  onSubmit={handleSaveProduct}
                  className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#2d1e22]">
                      {editingProduct ? `Editing: ${editingProduct.name}` : 'Create New Product'}
                    </h3>
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="text-xs text-[#9e5461] underline"
                      >
                        Cancel Edit / New Product
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Product Name
                      </label>
                      <input
                        type="text"
                        required
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">SKU</label>
                      <input
                        type="text"
                        required
                        value={prodSku}
                        onChange={(e) => setProdSku(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Category
                      </label>
                      <select
                        value={prodCategory}
                        onChange={(e) => setProdCategory(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                      >
                        {data.categories.map((c: any) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name} ({c.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Selling Price (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={prodPriceRupees}
                        onChange={(e) => setProdPriceRupees(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Purchase Cost (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={prodCostRupees}
                        onChange={(e) => setProdCostRupees(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Packaging Cost (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={prodPkgRupees}
                        onChange={(e) => setProdPkgRupees(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Physical Stock
                      </label>
                      <input
                        type="number"
                        required
                        value={prodStock}
                        onChange={(e) => setProdStock(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Publication Status
                      </label>
                      <select
                        value={prodStatus}
                        onChange={(e) => setProdStatus(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                      >
                        <option value="draft">Draft (Unpublished)</option>
                        <option value="active">Active (Published)</option>
                        <option value="coming-soon">Coming Soon</option>
                        <option value="out-of-stock">Out of Stock</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                      Description &amp; Confirmed Contents
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={prodDescription}
                      onChange={(e) => setProdDescription(e.target.value)}
                      className="w-full rounded-lg border border-[#e4b7c0] p-2.5 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#2d1e22]">
                      <input
                        type="checkbox"
                        checked={prodConfirmed}
                        onChange={(e) => setProdConfirmed(e.target.checked)}
                        className="accent-[#9e5461]"
                      />
                      <span>
                        I confirm the actual contents, stock quantity, and selling price are verified for publication
                      </span>
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#83424e]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingProduct ? 'Save Product Changes' : 'Create Product'}</span>
                    </button>
                  </div>
                </form>

                {/* Catalogue Table */}
                <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs font-tabular">
                    <thead className="bg-[#fdf2f4] text-[#6e5259] border-b border-[#e4b7c0]">
                      <tr>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-4">SKU</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Price</th>
                        <th className="py-2.5 px-4 text-right">WAC Cost</th>
                        <th className="py-2.5 px-4 text-right">Available</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5e4e8]">
                      {data.products.map((p: any) => (
                        <tr key={p.id} className="hover:bg-[#fffafb]">
                          <td className="py-2.5 px-4 font-semibold text-[#2d1e22]">{p.name}</td>
                          <td className="py-2.5 px-4">{p.sku}</td>
                          <td className="py-2.5 px-4">{p.categorySlug}</td>
                          <td className="py-2.5 px-4 uppercase font-medium text-[#7a3b47]">
                            {p.status}
                          </td>
                          <td className="py-2.5 px-4 text-right">{formatINR(p.sellingPricePaise)}</td>
                          <td className="py-2.5 px-4 text-right">{formatINR(p.purchaseCostPaise)}</td>
                          <td className="py-2.5 px-4 text-right">
                            {p.availableQty} (Res: {p.reservedQty})
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => startEditingProduct(p)}
                              className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-[#fdf2f4] text-[#7a3b47] font-medium hover:bg-[#fce9ee]"
                            >
                              Edit / Publish
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              /* CUSTOMER REVIEWS MODERATION SUB-TAB */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fffdfb] p-4 rounded-xl border border-[#e4b7c0]">
                  <div>
                    <h2 className="text-base font-bold text-[#2d1e22]">
                      Customer Reviews Moderation
                    </h2>
                    <p className="text-xs text-[#5c4349] mt-0.5">
                      Only verified purchasers who completed an order can submit authentic product reviews. Unverified or abusive reviews can be rejected or kept pending.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => {
                      const count =
                        st === 'all'
                          ? (data.reviews || []).length
                          : (data.reviews || []).filter((r: any) => r.status === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setReviewFilter(st)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                            reviewFilter === st
                              ? 'bg-[#9e5461] text-white'
                              : 'bg-white text-[#5c4349] border border-[#e4b7c0] hover:bg-[#fdf2f4]'
                          }`}
                        >
                          {st} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reviews List */}
                <div className="space-y-3">
                  {(data.reviews || [])
                    .filter((r: any) => (reviewFilter === 'all' ? true : r.status === reviewFilter))
                    .map((rev: any) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-xl border border-[#e4b7c0] bg-white space-y-2 shadow-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#2d1e22]">
                                {rev.product_name || rev.product_id}
                              </span>
                              <span className="text-amber-500 text-xs">
                                {'★'.repeat(rev.rating)}
                                {'☆'.repeat(5 - rev.rating)}
                              </span>
                              {rev.is_verified_purchase ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                  ✓ Verified Order {rev.order_number}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-[#5c4349] mt-0.5">
                              By <strong>{rev.customer_name}</strong> ·{' '}
                              <span className="text-[11px] text-[#8c6b73]">
                                {rev.created_at?.slice(0, 10)}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                rev.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rev.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rev.status}
                            </span>

                            <div className="flex items-center gap-1">
                              {rev.status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReviewStatus(rev.id, 'approved')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-semibold hover:bg-emerald-800"
                                >
                                  Approve
                                </button>
                              )}
                              {rev.status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReviewStatus(rev.id, 'rejected')}
                                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700"
                                >
                                  Reject
                                </button>
                              )}
                              {rev.status !== 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReviewStatus(rev.id, 'pending')}
                                  className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-[#fdf2f4] text-[#7a3b47] text-[11px] font-semibold hover:bg-[#fce9ee]"
                                >
                                  Reset Pending
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {rev.review_title && (
                          <h4 className="text-xs font-bold text-[#2d1e22]">{rev.review_title}</h4>
                        )}
                        <p className="text-xs text-[#5c4349] leading-relaxed">{rev.review_text}</p>
                      </div>
                    ))}

                  {(data.reviews || []).filter((r: any) =>
                    reviewFilter === 'all' ? true : r.status === reviewFilter
                  ).length === 0 && (
                    <div className="p-8 text-center rounded-xl border border-dashed border-[#e4b7c0] bg-white">
                      <p className="text-xs text-[#6e5259]">
                        No customer reviews found matching filter &quot;{reviewFilter}&quot;. Verified reviews submitted by real customers on the storefront will appear here for moderation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            )}

            {/* 3. CATEGORIES & HOMEPAGE */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0d8de] pb-3.5">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2d1e22]">
                      3. Category Photos &amp; Navigation
                    </h1>
                    <p className="text-xs text-[#5c4349] mt-0.5">
                      Manage visual photography, promotional assets, and display status for all 5 store categories. Sourced imagery conforms to Pretty Charm's blush pink and warm cream aesthetic.
                    </p>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800">
                    5/5 Categories Verified with Photography
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {data.categories.map((c: any) => {
                    const currentImg = c.imageUrl || c.image_url;
                    const isUploading = Boolean(categoryImageUploading[c.id]);
                    return (
                      <div
                        key={c.id}
                        data-testid={`category-card-${c.id}`}
                        className="rounded-2xl border border-[#e4b7c0] bg-white overflow-hidden shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-4/3 bg-[#fdf2f4] overflow-hidden border-b border-[#f0d8de]">
                            {currentImg ? (
                              <img
                                src={currentImg}
                                alt={c.name}
                                className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-[#9e5461]">
                                No category photo set
                              </div>
                            )}
                            <div className="absolute top-2.5 right-2.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  c.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md font-medium">
                              Display Order: {c.displayOrder ?? c.display_order ?? 1}
                            </div>
                          </div>

                          <div className="p-4 space-y-2">
                            <div className="flex items-baseline justify-between">
                              <h3 className="text-base font-bold text-[#2d1e22]">{c.name}</h3>
                              <code className="text-[10px] text-[#9e5461] bg-[#fdf2f4] px-1.5 py-0.5 rounded">
                                {c.slug || c.id}
                              </code>
                            </div>
                            <p className="text-xs text-[#6e5259] leading-relaxed">{c.description}</p>
                          </div>
                        </div>

                        <div className="p-4 pt-0 space-y-2 border-t border-[#f5e4e8] mt-2">
                          <label className="block text-[11px] font-semibold text-[#5c4349] pt-2">
                            Update Category Photo:
                          </label>
                          <div className="flex items-center gap-2">
                            <label
                              data-testid={`upload-category-btn-${c.id}`}
                              className="px-3 py-1.5 rounded-xl border border-[#e4b7c0] bg-[#fdf2f4] text-xs font-medium text-[#7a3b47] hover:bg-[#fce9ee] cursor-pointer inline-flex items-center gap-1.5 flex-1 justify-center disabled:opacity-50"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUpdateCategoryImage(c.id, undefined, file);
                                }}
                              />
                              {isUploading ? 'Uploading...' : 'Upload New Photo'}
                            </label>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              placeholder="Or paste image URL (/uploads/...)"
                              value={categoryImageInputs[c.id] || ''}
                              onChange={(e) =>
                                setCategoryImageInputs((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              className="flex-1 rounded-lg border border-[#e4b7c0] px-2.5 py-1 text-xs bg-white"
                            />
                            <button
                              type="button"
                              disabled={isUploading || !categoryImageInputs[c.id]}
                              onClick={() => {
                                if (categoryImageInputs[c.id]) {
                                  handleUpdateCategoryImage(c.id, categoryImageInputs[c.id]);
                                  setCategoryImageInputs((prev) => ({ ...prev, [c.id]: '' }));
                                }
                              }}
                              className="px-3 py-1 rounded-lg bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#84414d] disabled:opacity-40"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  4. Inventory Balances &amp; Stock Movements
                </h1>

                <form
                  onSubmit={handleAdjustInventory}
                  className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4"
                >
                  <h3 className="text-base font-semibold text-[#2d1e22]">
                    Record Stock Adjustment / Damaged / Returned Stock
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Product
                      </label>
                      <select
                        value={adjProductId}
                        onChange={(e) => setAdjProductId(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                      >
                        {data.products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.stockQty})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Movement Type
                      </label>
                      <select
                        value={adjType}
                        onChange={(e) => setAdjType(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                      >
                        <option value="adjustment">Manual Adjustment</option>
                        <option value="damaged">Damaged Stock Write-Off (-)</option>
                        <option value="returned">Customer Return Restock (+)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Quantity Delta (e.g. 5 or -2)
                      </label>
                      <input
                        type="number"
                        required
                        value={adjDelta}
                        onChange={(e) => setAdjDelta(e.target.value)}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Mandatory Reason
                      </label>
                      <input
                        type="text"
                        required
                        value={adjReason}
                        onChange={(e) => setAdjReason(e.target.value)}
                        placeholder="e.g. Cycle count verification"
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold"
                  >
                    Record Movement
                  </button>
                </form>

                {/* Stock Movement History */}
                <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-x-auto">
                  <div className="px-4 py-3 bg-[#fdf2f4] border-b border-[#e4b7c0]">
                    <h3 className="text-base font-semibold text-[#2d1e22]">
                      Immutable Stock Movement Ledger
                    </h3>
                  </div>
                  <table className="w-full text-left text-xs font-tabular">
                    <thead className="bg-[#fff8fa] text-[#6e5259] border-b border-[#f0d8de]">
                      <tr>
                        <th className="py-2 px-4">Timestamp</th>
                        <th className="py-2 px-4">Type</th>
                        <th className="py-2 px-4">Product ID</th>
                        <th className="py-2 px-4 text-right">Delta</th>
                        <th className="py-2 px-4 text-right">Balance After</th>
                        <th className="py-2 px-4">Reference &amp; Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5e4e8]">
                      {data.inventoryMovements.map((m: any) => (
                        <tr key={m.id}>
                          <td className="py-2 px-4">{m.created_at.slice(0, 19).replace('T', ' ')}</td>
                          <td className="py-2 px-4 uppercase font-medium">{m.movement_type}</td>
                          <td className="py-2 px-4">{m.product_id}</td>
                          <td className="py-2 px-4 text-right font-semibold">
                            {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                          </td>
                          <td className="py-2 px-4 text-right">{m.balance_after}</td>
                          <td className="py-2 px-4">
                            {m.reference_id} — {m.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. PURCHASE & SUPPLIERS */}
            {activeTab === 'purchases' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  5. Purchase Orders, Goods Receipt &amp; Suppliers
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Receive Goods Form */}
                  <form
                    onSubmit={handleReceivePurchase}
                    className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-3"
                  >
                    <h3 className="text-base font-semibold text-[#2d1e22]">
                      Receive Goods (Updates Stock &amp; Weighted Average Cost)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                          PO Number
                        </label>
                        <input
                          type="text"
                          required
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                          Supplier
                        </label>
                        <select
                          value={poSupplierId}
                          onChange={(e) => setPoSupplierId(e.target.value)}
                          className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                        >
                          {data.suppliers.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                          Product
                        </label>
                        <select
                          value={poProductId}
                          onChange={(e) => setPoProductId(e.target.value)}
                          className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                        >
                          {data.products.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                          Received Qty
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={poQty}
                          onChange={(e) => setPoQty(e.target.value)}
                          className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                          Unit Cost (₹)
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={poUnitCostRupees}
                          onChange={(e) => setPoUnitCostRupees(e.target.value)}
                          className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={poNotes}
                      onChange={(e) => setPoNotes(e.target.value)}
                      placeholder="Invoice / batch notes"
                      className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold"
                    >
                      Receive Stock &amp; Recalculate WAC
                    </button>
                  </form>

                  {/* Add Supplier Form */}
                  <form
                    onSubmit={handleCreateSupplier}
                    className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-3"
                  >
                    <h3 className="text-base font-semibold text-[#2d1e22]">Add New Supplier</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        value={supName}
                        onChange={(e) => setSupName(e.target.value)}
                        placeholder="Supplier / Vendor Name"
                        className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={supContact}
                        onChange={(e) => setSupContact(e.target.value)}
                        placeholder="Contact Person"
                        className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={supPhone}
                        onChange={(e) => setSupPhone(e.target.value)}
                        placeholder="Phone Number"
                        className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={supCity}
                        onChange={(e) => setSupCity(e.target.value)}
                        placeholder="City"
                        className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#2d1e22] text-white text-xs font-semibold"
                    >
                      Save Supplier
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 6. ORDERS, WHATSAPP PAYMENT WORKFLOW & SHIPMENT DISPATCH */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold text-[#2d1e22]">
                      6. WhatsApp-Assisted Order Processing, Payment Verification &amp; Fulfilment
                    </h1>
                    <p className="text-xs text-[#6e5259] mt-0.5">
                      Protected by server-side Admin authentication. Payment status (<code>pending</code> → <code>paid</code>) is strictly separate from order fulfilment status (<code>awaiting_payment</code> → <code>confirmed</code> → <code>shipped</code>).
                    </p>
                  </div>
                </div>

                {/* Payment Safety & Click-to-Chat Honesty Banner */}
                <div
                  data-testid="admin-payment-safety-banner"
                  className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1.5 text-xs text-amber-950"
                >
                  <p className="font-bold">
                    Payment Safety, Merchant Account Eligibility &amp; WhatsApp Click-to-Chat Notice
                  </p>
                  <ul className="list-disc pl-5 space-y-1 leading-relaxed">
                    <li>
                      <strong>No Fake Verification:</strong> Never mark orders paid from WhatsApp screenshots, customer UTR text, or browser redirects alone. Only click <em>Mark Payment Received</em> after verifying the credit in your actual bank or UPI statement.
                    </li>
                    <li>
                      <strong>Merchant Account Eligibility Warning:</strong> Do not assume a personal or minor UPI account is approved for commercial/merchant use. Confirm merchant UPI/bank account eligibility with your bank or payment provider before accepting commercial payments.
                    </li>
                    <li>
                      <strong>Click-to-Chat vs Official API:</strong> Buttons below open WhatsApp Click-to-Chat (<code>wa.me</code>) with a prefilled message ready for you to press <strong>Send</strong> manually. Automatic outbound messages require a configured official WhatsApp Business Platform/API and approved templates.
                    </li>
                  </ul>
                </div>

                {/* Quick Payment Link / UPI / QR Configuration for WhatsApp Instructions */}
                <div className="rounded-xl border border-[#e4b7c0] bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#2d1e22]">
                      Manual Payment Link, Merchant UPI ID &amp; QR Image Configuration (Included in Prefilled Payment Messages)
                    </h2>
                    <span className="text-[11px] text-[#7a3b47]">
                      Auto-saves on blur
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-[#5c4349] mb-1">
                        Merchant UPI ID
                      </label>
                      <input
                        type="text"
                        defaultValue={data.settings.general.manualPaymentUpiId || ''}
                        onBlur={(e) =>
                          handleUpdateSettings({ manualPaymentUpiId: e.target.value })
                        }
                        placeholder="e.g. prettycharm@icici"
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#5c4349] mb-1">
                        Payment Link URL (Optional)
                      </label>
                      <input
                        type="text"
                        defaultValue={data.settings.general.manualPaymentLink || ''}
                        onBlur={(e) =>
                          handleUpdateSettings({ manualPaymentLink: e.target.value })
                        }
                        placeholder="https://rzp.io/i/..."
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#5c4349] mb-1">
                        UPI QR Image URL (Optional)
                      </label>
                      <input
                        type="text"
                        defaultValue={data.settings.general.manualPaymentQrUrl || ''}
                        onBlur={(e) =>
                          handleUpdateSettings({ manualPaymentQrUrl: e.target.value })
                        }
                        placeholder="https://prettycharm.in/qr.png"
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Search & Filter Orders Bar */}
                <div className="rounded-xl border border-[#e4b7c0] bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#5c4349] mb-1">
                      Search Orders (Order ID, Customer Name, Phone)
                    </label>
                    <input
                      type="search"
                      data-testid="admin-order-search-input"
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Search PC-2026-1001, Ananya, 98765..."
                      className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5c4349] mb-1">
                      Filter by Payment Status
                    </label>
                    <select
                      data-testid="admin-order-payment-filter"
                      value={orderPaymentFilter}
                      onChange={(e) => setOrderPaymentFilter(e.target.value)}
                      className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 bg-white"
                    >
                      <option value="all">All Payment Statuses</option>
                      <option value="pending">pending</option>
                      <option value="paid">paid</option>
                      <option value="awaiting verification">Awaiting Verification</option>
                      <option value="refunded">refunded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5c4349] mb-1">
                      Filter by Fulfilment Status
                    </label>
                    <select
                      data-testid="admin-order-status-filter"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 bg-white"
                    >
                      <option value="all">All Fulfilment Statuses</option>
                      <option value="awaiting_payment">awaiting_payment</option>
                      <option value="confirmed">confirmed</option>
                      <option value="processing">processing</option>
                      <option value="packed">packed</option>
                      <option value="shipped">shipped</option>
                      <option value="delivered">delivered</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  const filteredOrders = (data.recentOrders || []).filter((o: any) => {
                    const q = orderSearchQuery.trim().toLowerCase();
                    if (q) {
                      const hay = `${o.orderNumber} ${o.customerName} ${o.customerMobile} ${o.shippingAddress?.city || ''} ${o.shippingAddress?.pincode || ''}`.toLowerCase();
                      if (!hay.includes(q)) return false;
                    }
                    if (
                      orderPaymentFilter !== 'all' &&
                      String(o.paymentStatus || '').toLowerCase() !== orderPaymentFilter.toLowerCase()
                    ) {
                      return false;
                    }
                    if (
                      orderStatusFilter !== 'all' &&
                      String(o.orderStatus || '').toLowerCase() !== orderStatusFilter.toLowerCase()
                    ) {
                      return false;
                    }
                    return true;
                  });

                  if (filteredOrders.length === 0) {
                    return (
                      <p className="text-sm text-[#6e5259] bg-white p-6 rounded-xl border border-[#e4b7c0]">
                        No orders match the current search/filter criteria.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {filteredOrders.map((o: any) => {
                        const isPaid = String(o.paymentStatus || '').toLowerCase() === 'paid';
                        const isConfirmed =
                          String(o.orderStatus || '').toLowerCase() === 'confirmed';

                        return (
                          <div
                            key={o.id}
                            data-testid={`admin-order-card-${o.orderNumber}`}
                            className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4"
                          >
                            {/* Order Header */}
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0d8de] pb-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-base font-bold text-[#2d1e22] font-tabular">
                                    {o.orderNumber}
                                  </span>
                                  <span
                                    data-testid={`admin-order-payment-badge-${o.orderNumber}`}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                                      isPaid
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    Payment: {o.paymentStatus}
                                  </span>
                                  <span
                                    data-testid={`admin-order-status-badge-${o.orderNumber}`}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                                      isConfirmed
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-[#fdf2f4] text-[#7a3b47] border border-[#e4b7c0]'
                                    }`}
                                  >
                                    Fulfilment: {o.orderStatus}
                                  </span>
                                </div>
                                <p className="text-xs text-[#6e5259] font-tabular">
                                  Created: {new Date(o.createdAt).toLocaleString('en-IN')}
                                </p>
                              </div>

                              <div className="text-right font-tabular">
                                <p className="text-base font-bold text-[#2d1e22]">
                                  Total: {formatINR(o.totalPaise)}
                                </p>
                                <p className="text-[11px] text-[#6e5259]">
                                  Subtotal: {formatINR(o.subtotalPaise)} · Shipping:{' '}
                                  {o.shippingFeePaise === 0 ? 'Free' : formatINR(o.shippingFeePaise)}
                                </p>
                              </div>
                            </div>

                            {/* Customer Details & Itemized Products */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              <div className="rounded-lg bg-[#fff8fa] border border-[#f0d8de] p-3 space-y-1.5">
                                <p className="font-bold text-[#2d1e22]">Customer &amp; Delivery Address</p>
                                <p className="text-[#2d1e22]">
                                  <strong>Name:</strong> {o.customerName} ·{' '}
                                  <strong>Phone:</strong> +91 {o.customerMobile}
                                </p>
                                <p className="text-[#5c4349]">
                                  <strong>Address:</strong>{' '}
                                  {[
                                    o.shippingAddress?.houseFlat,
                                    o.shippingAddress?.streetLocality,
                                    o.shippingAddress?.city,
                                    o.shippingAddress?.state,
                                    o.shippingAddress?.pincode,
                                  ]
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                                {o.shippingAddress?.deliveryInstructions && (
                                  <p className="text-[#7a3b47] italic">
                                    <strong>Delivery Instructions:</strong>{' '}
                                    {o.shippingAddress.deliveryInstructions}
                                  </p>
                                )}

                                {/* Step 4 & 5: Copy Customer WhatsApp Contact Link & Send Payment Instructions/Link/QR */}
                                <div className="pt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    data-testid={`copy-wa-link-${o.orderNumber}`}
                                    onClick={() => {
                                      navigator.clipboard?.writeText(
                                        o.customerWhatsappContactUrl ||
                                          `https://wa.me/91${o.customerMobile}`
                                      );
                                      showNotice(
                                        `Copied customer WhatsApp contact link for ${o.customerName}`
                                      );
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-[#e4b7c0] bg-white text-[#2d1e22] font-semibold hover:border-[#9e5461] cursor-pointer"
                                  >
                                    Copy Customer WhatsApp Link
                                  </button>

                                  <a
                                    href={o.adminPaymentInstructionWhatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    data-testid={`send-payment-wa-${o.orderNumber}`}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold inline-flex items-center gap-1"
                                  >
                                    <span>Send Payment Instructions / Link / QR via WhatsApp</span>
                                  </a>
                                </div>
                              </div>

                              <div className="rounded-lg bg-[#fff8fa] border border-[#f0d8de] p-3 space-y-1.5">
                                <p className="font-bold text-[#2d1e22]">
                                  Ordered Products ({o.items?.length || 0})
                                </p>
                                <div className="space-y-1 max-h-36 overflow-y-auto">
                                  {(o.items || []).map((it: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between gap-2 border-b last:border-b-0 border-[#f0d8de] py-1"
                                    >
                                      <span>
                                        {it.product_name}
                                        {it.variant_name ? ` (${it.variant_name})` : ''} ×{' '}
                                        <strong>{it.quantity}</strong>
                                      </span>
                                      <span className="font-tabular font-semibold">
                                        {formatINR(it.line_total_paise)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* 3-Column Action Workflow: (1) Payment Verification, (2) Order Confirmation & WhatsApp Handoff, (3) Shipment Dispatch */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              {/* Column 1: Step 6 & 7 — Mark Payment Received (with Audit Trail) */}
                              <div className="p-3.5 rounded-lg bg-[#fff8fa] border border-[#f0d8de] space-y-2">
                                <p className="font-bold text-[#2d1e22]">
                                  Step 1: Verify Bank / UPI Payment
                                </p>
                                <p className="text-[11px] text-[#5c4349]">
                                  Current Payment Status:{' '}
                                  <strong className={isPaid ? 'text-emerald-800' : 'text-amber-800'}>
                                    {o.paymentStatus}
                                  </strong>
                                </p>
                                {o.customerSubmittedRef && (
                                  <p className="text-[11px] text-[#7a3b47]">
                                    Customer Note/Ref: <strong>{o.customerSubmittedRef}</strong>
                                  </p>
                                )}

                                {isPaid ? (
                                  <div
                                    data-testid={`payment-verified-info-${o.orderNumber}`}
                                    className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] text-emerald-900 space-y-0.5"
                                  >
                                    <p className="font-semibold">Payment Verified (paid)</p>
                                    <p>
                                      By: <strong>{o.verifiedByAdminEmail || 'Admin'}</strong>
                                    </p>
                                    {o.verifiedAt && (
                                      <p className="font-tabular">
                                        When: {new Date(o.verifiedAt).toLocaleString('en-IN')}
                                      </p>
                                    )}
                                    {o.verifiedBankUtr && (
                                      <p className="font-tabular">
                                        Bank/UPI Ref: {o.verifiedBankUtr}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      data-testid={`utr-input-${o.orderNumber}`}
                                      value={selectedOrderId === o.id ? utrInput : ''}
                                      onChange={(e) => {
                                        setSelectedOrderId(o.id);
                                        setUtrInput(e.target.value);
                                      }}
                                      placeholder="Verified Bank/UPI Ref (min 6 chars)"
                                      className="w-full rounded-lg border border-[#e4b7c0] px-2.5 py-1.5 bg-white font-tabular"
                                    />
                                    <button
                                      type="button"
                                      data-testid={`verify-payment-btn-${o.orderNumber}`}
                                      onClick={() => handleVerifyManualPayment(o)}
                                      className="w-full py-2 px-3 rounded-lg bg-[#9e5461] hover:bg-[#83424e] text-white font-semibold cursor-pointer"
                                    >
                                      Mark Payment Received (Bank Checked)
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Column 2: Step 8, 9 & 10 — Confirm Order & Send Confirmation via WhatsApp */}
                              <div className="p-3.5 rounded-lg bg-[#fff8fa] border border-[#f0d8de] space-y-2">
                                <p className="font-bold text-[#2d1e22]">
                                  Step 2: Confirm Order &amp; WhatsApp Confirmation
                                </p>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!isPaid || isConfirmed || confirmingOrderId === o.id}
                                    data-testid={`confirm-order-btn-${o.orderNumber}`}
                                    onClick={() => handleConfirmOrder(o)}
                                    className="w-full py-2 px-3 rounded-lg bg-[#2d1e22] hover:bg-[#432c32] disabled:opacity-45 text-white font-semibold cursor-pointer"
                                  >
                                    {isConfirmed
                                      ? 'Order Confirmed'
                                      : confirmingOrderId === o.id
                                      ? 'Confirming...'
                                      : isPaid
                                      ? 'Confirm Order (After Verified Payment)'
                                      : 'Verify Payment First to Confirm'}
                                  </button>
                                </div>

                                <a
                                  href={o.adminOrderConfirmationWhatsappUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-testid={`send-confirmation-wa-${o.orderNumber}`}
                                  className={`w-full py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 ${
                                    isPaid
                                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                      : 'bg-gray-200 text-gray-600 pointer-events-none'
                                  }`}
                                >
                                  <span>Send Confirmation via WhatsApp</span>
                                </a>

                                <div className="pt-1">
                                  <label className="block text-[11px] font-semibold text-[#5c4349] mb-1">
                                    Fulfilment Status Stage:
                                  </label>
                                  <select
                                    data-testid={`fulfilment-status-select-${o.orderNumber}`}
                                    value={o.orderStatus}
                                    onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                                    className="w-full rounded-lg border border-[#e4b7c0] px-2.5 py-1.5 bg-white"
                                  >
                                    {[
                                      'awaiting_payment',
                                      'confirmed',
                                      'processing',
                                      'packed',
                                      'shipped',
                                      'delivered',
                                      'cancelled',
                                      'Pending Confirmation',
                                      'Confirmed',
                                      'Processing',
                                      'Packed',
                                      'Shipped',
                                      'Delivered',
                                      'Cancelled',
                                      'Returned',
                                      'Refunded',
                                    ].map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Column 3: Shipment & Carrier ETA */}
                              <div className="p-3.5 rounded-lg bg-[#fff8fa] border border-[#f0d8de] space-y-2">
                                <p className="font-bold text-[#2d1e22]">
                                  Step 3: Shipment: {o.shipmentStatus}
                                </p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="text"
                                    placeholder={
                                      o.shipment?.courier_name || 'Courier (e.g. Delhivery)'
                                    }
                                    onChange={(e) => setCourierInput(e.target.value)}
                                    className="rounded border border-[#e4b7c0] px-2 py-1 bg-white"
                                  />
                                  <input
                                    type="text"
                                    placeholder={o.shipment?.awb_number || 'AWB Number'}
                                    onChange={(e) => setAwbInput(e.target.value)}
                                    className="rounded border border-[#e4b7c0] px-2 py-1 bg-white"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Carrier ETA (optional)"
                                    onChange={(e) => setEtaInput(e.target.value)}
                                    className="rounded border border-[#e4b7c0] px-2 py-1 bg-white"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Actual Courier Cost ₹"
                                    onChange={(e) => setActualCourierCostRupees(e.target.value)}
                                    className="rounded border border-[#e4b7c0] px-2 py-1 bg-white"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSaveShipment(o.id)}
                                  className="w-full py-1.5 rounded-lg bg-[#2d1e22] text-white font-semibold cursor-pointer"
                                >
                                  Save Courier &amp; AWB
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 7. CUSTOMERS */}
            {activeTab === 'customers' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">7. Customers Directory</h1>
                <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs font-tabular">
                    <thead className="bg-[#fdf2f4] text-[#6e5259] border-b border-[#e4b7c0]">
                      <tr>
                        <th className="py-2.5 px-4">Full Name</th>
                        <th className="py-2.5 px-4">Mobile</th>
                        <th className="py-2.5 px-4">Email</th>
                        <th className="py-2.5 px-4">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5e4e8]">
                      {data.customers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-[#6e5259]">
                            No customer records yet.
                          </td>
                        </tr>
                      ) : (
                        data.customers.map((c: any) => (
                          <tr key={c.id}>
                            <td className="py-2.5 px-4 font-semibold">{c.full_name}</td>
                            <td className="py-2.5 px-4">{c.mobile}</td>
                            <td className="py-2.5 px-4">{c.email || 'Guest Checkout'}</td>
                            <td className="py-2.5 px-4">{c.created_at.slice(0, 10)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. SALES & REVENUE */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">8. Sales &amp; Revenue Report</h1>
                <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-xl border border-[#e4b7c0]">
                  <div>
                    <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-lg border border-[#e4b7c0] px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-lg border border-[#e4b7c0] px-3 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchOverview()}
                    className="px-4 py-2 rounded-lg bg-[#9e5461] text-white text-xs font-semibold"
                  >
                    Apply Date Filter
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-tabular">
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">Gross Order Value (Excl. Cancelled)</p>
                    <p className="text-2xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.grossSalesPaise)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">Verified Paid Revenue</p>
                    <p className="text-2xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.paidRevenuePaise)}
                    </p>
                    <p className="text-[11px] text-[#8c4a56] mt-1">
                      Unpaid &amp; Demo orders strictly excluded
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">Net Paid Revenue (After Refunds)</p>
                    <p className="text-2xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.netPaidRevenuePaise)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 9. COST & PROFIT */}
            {activeTab === 'profit' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  9. Cost of Goods Sold (COGS) &amp; Profitability Analysis
                </h1>
                <p className="text-xs text-[#5c4349]">
                  <strong>Formula Transparency:</strong> Unsold inventory ({formatINR(data.financialReport.unsoldInventoryValuePaise)}) is an asset and is never counted in COGS. COGS uses historical product cost snapshots saved on each order item at the time of sale.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-tabular">
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">Realized COGS (Paid Orders)</p>
                    <p className="text-xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.cogsPaise)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">Packaging Costs</p>
                    <p className="text-xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.packagingCostPaise)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">Gross Profit</p>
                    <p className="text-xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.grossProfitPaise)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e4b7c0] bg-white p-4">
                    <p className="text-xs text-[#6e5259]">
                      {data.financialReport.isEstimated ? 'Estimated Net Profit' : 'Net Profit'}
                    </p>
                    <p className="text-xl font-bold text-[#2d1e22] mt-1">
                      {formatINR(data.financialReport.estimatedNetProfitPaise)}
                    </p>
                  </div>
                </div>

                {data.financialReport.missingInputs?.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <p className="font-semibold mb-1">
                      Profit is marked as Estimated due to missing cost inputs on some orders:
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {data.financialReport.missingInputs.map((m: string, idx: number) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 10. EXPENSES */}
            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  10. Marketing, Packaging &amp; Operating Expenses
                </h1>

                <form
                  onSubmit={handleAddExpense}
                  className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-3"
                >
                  <h3 className="text-base font-semibold text-[#2d1e22]">Log New Expense</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      required
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      placeholder="Expense Title (e.g. Satin Ribbon Roll)"
                      className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                    />
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs bg-white"
                    >
                      <option value="packaging">Packaging</option>
                      <option value="marketing">Marketing / Ads</option>
                      <option value="shipping">Courier / Shipping Supplies</option>
                      <option value="operations">Operations</option>
                    </select>
                    <input
                      type="number"
                      required
                      min={1}
                      value={expAmountRupees}
                      onChange={(e) => setExpAmountRupees(e.target.value)}
                      placeholder="Amount (₹)"
                      className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={expVendor}
                      onChange={(e) => setExpVendor(e.target.value)}
                      placeholder="Vendor Name"
                      className="rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold"
                  >
                    Record Expense
                  </button>
                </form>

                <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs font-tabular">
                    <thead className="bg-[#fdf2f4] text-[#6e5259] border-b border-[#e4b7c0]">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Title</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Vendor</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5e4e8]">
                      {data.expenses.map((e: any) => (
                        <tr key={e.id}>
                          <td className="py-2.5 px-4">{e.expense_date}</td>
                          <td className="py-2.5 px-4 font-semibold">{e.title}</td>
                          <td className="py-2.5 px-4 uppercase">{e.category}</td>
                          <td className="py-2.5 px-4">{e.vendor_name || '-'}</td>
                          <td className="py-2.5 px-4 text-right font-semibold">
                            {formatINR(e.amount_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 11. SHIPPING & SERVICEABLE PIN CODES */}
            {activeTab === 'shipping' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#2d1e22]">
                    11. Shipping Rules, Postal Validation &amp; Delivery Serviceability
                  </h1>
                  <p className="text-xs text-[#6e5259] mt-1">
                    Manage origin shipping rules, logistics delivery boundaries, India Post validation, and COD eligibility across India.
                  </p>
                </div>

                {/* Important Postal Validity vs Logistics Serviceability Notice */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-1.5 text-xs text-[#592531]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#9e5461] shrink-0" />
                    <h3 className="font-semibold text-sm text-[#2d1e22]">
                      Logistics Rule: Postal Validity vs. Delivery Serviceability
                    </h3>
                  </div>
                  <p className="text-[#6e5259]">
                    A valid 6-digit Indian PIN code registered in the India Post directory confirms that a postal location exists, but does <strong>not</strong> automatically mean our third-party logistics partners (e.g. Delhivery, BlueDart, DTDC) deliver to that address. Use the settings below to govern whether your store delivers Pan-India or only to explicitly whitelisted hubs, and whether Cash on Delivery (COD) is supported.
                  </p>
                </div>

                {/* Shipping Fee Tiers */}
                <div className="rounded-2xl border border-[#e4b7c0] bg-white p-5 space-y-3 shadow-sm">
                  <h3 className="text-base font-semibold text-[#2d1e22]">
                    Active Customer Shipping Fee Tiers (Dispatch Origin: Gurugram, Haryana)
                  </h3>
                  <p className="text-xs text-[#6e5259]">
                    Subtotal below {formatINR(data.settings.shippingRules.tier1MaxSubtotalPaise)}:{' '}
                    <strong>{formatINR(data.settings.shippingRules.tier1FeePaise)}</strong> ·{' '}
                    {formatINR(data.settings.shippingRules.tier1MaxSubtotalPaise)} to below{' '}
                    {formatINR(data.settings.shippingRules.freeShippingThresholdPaise)}:{' '}
                    <strong>{formatINR(data.settings.shippingRules.tier2FeePaise)}</strong> ·{' '}
                    {formatINR(data.settings.shippingRules.freeShippingThresholdPaise)}+:{' '}
                    <strong className="text-emerald-700">Free Shipping</strong>
                  </p>
                </div>

                {/* Store Delivery Policy Configuration */}
                <form
                  onSubmit={handleSaveDeliveryPolicy}
                  className="rounded-2xl border border-[#e4b7c0] bg-white p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#f5e4e8]">
                    <h3 className="text-base font-semibold text-[#2d1e22] flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#9e5461]" />
                      Storewide Delivery Serviceability Policy
                    </h3>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#fdf2f4] text-[#9e5461] font-medium border border-[#e5c2c9]">
                      Mode: {deliveryPolicyMode === 'pan_india' ? 'Pan-India Active' : 'Whitelist Only'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">Delivery Reach Mode</label>
                      <select
                        value={deliveryPolicyMode}
                        onChange={(e) => setDeliveryPolicyMode(e.target.value as any)}
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 bg-white text-xs"
                      >
                        <option value="pan_india">Pan-India Dispatch (All valid PINs deliverable)</option>
                        <option value="whitelist_only">Restricted (Whitelisted PINs only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">Cash on Delivery (COD) Rule</label>
                      <select
                        value={deliveryPolicyCodRule}
                        onChange={(e) => setDeliveryPolicyCodRule(e.target.value as any)}
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 bg-white text-xs"
                      >
                        <option value="all_serviceable">All Serviceable PINs</option>
                        <option value="whitelist_only">Only Whitelisted COD PINs</option>
                        <option value="disabled">Disabled (Prepaid UPI/Bank only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">Min Delivery ETA (Days)</label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={deliveryMinDays}
                        onChange={(e) => setDeliveryMinDays(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">Max Delivery ETA (Days)</label>
                      <input
                        type="number"
                        min={2}
                        max={21}
                        value={deliveryMaxDays}
                        onChange={(e) => setDeliveryMaxDays(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#5c3d42] block mb-1 font-semibold">
                      Customer Serviceability Disclaimer / Notice
                    </label>
                    <input
                      type="text"
                      value={deliveryNotice}
                      onChange={(e) => setDeliveryNotice(e.target.value)}
                      placeholder="e.g. Standard Pan-India courier dispatch from Gurugram (122001), Haryana."
                      className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPolicy}
                      className="px-5 py-2 rounded-xl bg-[#9e5461] hover:bg-[#853f4c] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      {savingPolicy ? 'Saving Policy...' : 'Save Delivery Policy'}
                    </button>
                  </div>
                </form>

                {/* Add Serviceable Indian PIN Code Form */}
                <form
                  onSubmit={handleAddPinCode}
                  className="rounded-2xl border border-[#e4b7c0] bg-white p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#f5e4e8]">
                    <h3 className="text-base font-semibold text-[#2d1e21] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#9e5461]" />
                      Add / Update Serviceable Indian PIN Code
                    </h3>
                    <span className="text-[11px] text-[#7a5960]">
                      Auto-verified with India Post Open Government Data
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">6-Digit Indian PIN *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={pinCodeInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setPinCodeInput(val);
                            if (val.length === 6) {
                              handleVerifyPinWithIndiaPost(val);
                            }
                          }}
                          placeholder="e.g. 122001 or 400001"
                          className="flex-1 rounded-xl border border-[#e4b7c0] px-3 py-2 text-xs font-tabular"
                        />
                        <button
                          type="button"
                          onClick={() => handleVerifyPinWithIndiaPost()}
                          disabled={pinVerifying}
                          className="px-2.5 py-1.5 rounded-xl border border-[#e4b7c0] bg-[#fdf2f4] text-[#9e5461] hover:bg-[#fce7eb] text-[11px] font-semibold shrink-0"
                        >
                          {pinVerifying ? 'Checking...' : 'Verify'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">City / Town *</label>
                      <input
                        type="text"
                        required
                        value={pinCityInput}
                        onChange={(e) => setPinCityInput(e.target.value)}
                        placeholder="e.g. Gurugram"
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">District</label>
                      <input
                        type="text"
                        value={pinDistrictInput}
                        onChange={(e) => setPinDistrictInput(e.target.value)}
                        placeholder="e.g. Gurgaon"
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[#5c3d42] block mb-1 font-semibold">State / UT *</label>
                      <select
                        value={pinStateInput}
                        onChange={(e) => setPinStateInput(e.target.value)}
                        className="w-full rounded-xl border border-[#e4b7c0] px-3 py-2 bg-white text-xs"
                      >
                        {ALL_INDIAN_STATES_AND_UTS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#f5e4e8]">
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pinIsServiceable}
                          onChange={(e) => setPinIsServiceable(e.target.checked)}
                          className="rounded text-[#9e5461] focus:ring-[#9e5461]"
                        />
                        <span className="font-semibold text-[#2d1e21]">Delivery Serviceable</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pinCodAvailable}
                          onChange={(e) => setPinCodAvailable(e.target.checked)}
                          className="rounded text-[#9e5461] focus:ring-[#9e5461]"
                        />
                        <span className="font-semibold text-[#2d1e21]">COD Available</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#9e5461] hover:bg-[#853f4c] text-white text-xs font-semibold shadow-sm transition"
                    >
                      Save Serviceable PIN
                    </button>
                  </div>
                </form>

                {/* Filterable Serviceable PIN Codes Registry */}
                <div className="rounded-2xl border border-[#e4b7c0] bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#2d1e21]">
                        Delivery &amp; Serviceability Registry ({data.pincodes.length} configured)
                      </h3>
                      <p className="text-[11px] text-[#6e5259]">
                        Click any badge to toggle courier delivery serviceability or Cash on Delivery (COD).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#8c6b72] absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={pinSearchQuery}
                          onChange={(e) => setPinSearchQuery(e.target.value)}
                          placeholder="Search PIN / District / State..."
                          className="pl-8 pr-3 py-1.5 rounded-xl border border-[#e4b7c0] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                        />
                      </div>

                      <select
                        value={pinFilterStatus}
                        onChange={(e) => setPinFilterStatus(e.target.value as any)}
                        className="px-3 py-1.5 rounded-xl border border-[#e4b7c0] text-xs bg-white text-[#2d1e21]"
                      >
                        <option value="all">All Statuses</option>
                        <option value="serviceable">Serviceable Only</option>
                        <option value="unserviceable">Restricted Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#fdf2f4] text-[#6e5259] border-b border-[#e4b7c0]">
                        <tr>
                          <th className="py-2.5 px-3">PIN Code</th>
                          <th className="py-2.5 px-3">City / District</th>
                          <th className="py-2.5 px-3">State / UT</th>
                          <th className="py-2.5 px-3">Postal Source</th>
                          <th className="py-2.5 px-3">Delivery Serviceable</th>
                          <th className="py-2.5 px-3">COD Eligible</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5e4e8] font-tabular">
                        {data.pincodes
                          .filter((p: any) => {
                            if (pinFilterStatus === 'serviceable' && !p.isServiceable) return false;
                            if (pinFilterStatus === 'unserviceable' && p.isServiceable) return false;
                            if (pinSearchQuery.trim()) {
                              const q = pinSearchQuery.toLowerCase();
                              const hay = `${p.pincode} ${p.city} ${p.district || ''} ${p.state}`.toLowerCase();
                              return hay.includes(q);
                            }
                            return true;
                          })
                          .map((p: any) => (
                            <tr key={p.pincode} className="hover:bg-[#faf5f6]">
                              <td className="py-2.5 px-3 font-bold text-[#2d1e21]">{p.pincode}</td>
                              <td className="py-2.5 px-3 text-[#2d1e21]">
                                {p.city}{p.district && p.district !== p.city ? ` (${p.district})` : ''}
                              </td>
                              <td className="py-2.5 px-3 text-[#5c3d42]">{p.state}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> India Post
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(p.pincode, 'serviceable')}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                                    p.isServiceable
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                  }`}
                                  title="Click to toggle delivery serviceability"
                                >
                                  {p.isServiceable ? '✓ Serviceable' : '✕ Restricted'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(p.pincode, 'cod')}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                                    p.codAvailable
                                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                  title="Click to toggle Cash on Delivery"
                                >
                                  {p.codAvailable ? 'COD Active' : 'Prepaid Only'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePin(p.pincode)}
                                  className="text-[#9e5461] hover:text-rose-700 p-1 rounded-lg transition"
                                  title="Remove PIN code from registry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 12. REPORTS & EXCEL / CSV EXPORT */}
            {activeTab === 'exports' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  12. Reports &amp; Secure Excel (.xlsx) / CSV Exports
                </h1>
                <p className="text-xs text-[#6e5259]">
                  Every download below is protected by server-side admin session authentication, escapes untrusted cells against spreadsheet formula injection, and exports live database records in INR.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'Products', title: 'Products.xlsx', desc: 'Complete catalogue, SKUs, statuses, prices & WAC costs' },
                    { id: 'Inventory', title: 'Inventory.xlsx', desc: 'Physical stock, reserved stock, available stock & valuation' },
                    { id: 'PurchaseHistory', title: 'PurchaseHistory.xlsx', desc: 'Purchase orders & goods receipt history' },
                    { id: 'Orders', title: 'Orders.xlsx', desc: 'Customer orders, statuses, shipping fees & totals' },
                    { id: 'Customers', title: 'Customers.xlsx', desc: 'Customer contact records (Admin-restricted)' },
                    { id: 'SalesRevenue', title: 'SalesRevenue.xlsx', desc: 'Gross sales, verified paid revenue & net revenue' },
                    { id: 'ProductProfitMargins', title: 'ProductProfitMargins.xlsx', desc: 'Unit selling price vs purchase & packaging cost margins' },
                    { id: 'OrderProfitability', title: 'OrderProfitability.xlsx', desc: 'Per-order historical COGS snapshot & contribution profit' },
                    { id: 'Expenses', title: 'Expenses.xlsx', desc: 'Marketing, packaging & operating expense ledger' },
                    { id: 'LowStock', title: 'LowStock.xlsx', desc: 'Active products at or below low-stock threshold' },
                  ].map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-[#e4b7c0] bg-white p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-[#2d1e22]">{rep.title}</h3>
                        <p className="text-xs text-[#6e5259] mt-0.5">{rep.desc}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => downloadReport(rep.id, 'xlsx')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#83424e]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>.XLSX</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadReport(rep.id, 'csv')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#e4b7c0] bg-[#fdf2f4] text-[#7a3b47] text-xs font-semibold hover:bg-[#fce9ee]"
                        >
                          <span>.CSV</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 13. WHATSAPP & INSTAGRAM INTEGRATIONS */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  13. WhatsApp Click-to-Chat &amp; Instagram Configuration
                </h1>
                <div className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4">
                  <p className="text-xs text-[#5c4349] leading-relaxed">
                    <strong>Honest Integration Status:</strong> Storefront WhatsApp buttons use validated Click-to-Chat links (<code>wa.me</code>) where the customer or admin presses Send manually. Automated WhatsApp Cloud API messages and Shiprocket auto-sync remain disabled until official business credentials are added in environment settings.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Store WhatsApp Number (Country code + digits, e.g. 919000000000)
                      </label>
                      <input
                        type="text"
                        defaultValue={data.settings.general.supportWhatsapp}
                        onBlur={(e) => handleUpdateSettings({ supportWhatsapp: e.target.value })}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                        Instagram Handle
                      </label>
                      <input
                        type="text"
                        defaultValue={data.settings.general.instagramHandle}
                        onBlur={(e) => handleUpdateSettings({ instagramHandle: e.target.value })}
                        className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 14. STORE SETTINGS & PAYMENT MODE */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  14. Store Settings &amp; Safe Staged Payment Configuration
                </h1>
                <div className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4">
                  <h3 className="text-base font-semibold text-[#2d1e22]">
                    Homepage Announcement Bar (Admin-Configurable)
                  </h3>
                  <p className="text-xs text-[#6e5259]">
                    Configure the slim editorial top banner displayed on the storefront homepage. Avoid unverified offers or unconfirmed delivery promises.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-[#5c4349] mb-1">
                      Announcement Bar Text
                    </label>
                    <input
                      type="text"
                      defaultValue={data.settings.general.announcementBanner || ''}
                      onBlur={(e) => handleUpdateSettings({ announcementBanner: e.target.value })}
                      className="w-full rounded-lg border border-[#e4b7c0] px-3 py-2 text-xs"
                      placeholder="e.g. Thoughtfully chosen gifts & pretty essentials · Verified studio dispatch"
                    />
                  </div>
                </div>

                {/* Combo Offers Configuration */}
                <div className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0d8de] pb-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#2d1e22]">
                        Smart Cart Combo Offers &amp; Automatic Discounts
                      </h3>
                      <p className="text-xs text-[#6e5259] mt-0.5">
                        Configure threshold discounts applied automatically when customers add qualifying items to their cart.
                      </p>
                    </div>
                    {comboOffersDraft && (
                      <button
                        type="button"
                        disabled={savingCombos}
                        onClick={() => handleSaveComboOffers(comboOffersDraft)}
                        className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {savingCombos ? 'Saving...' : 'Save Combo Offers Changes'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {((comboOffersDraft || data.comboOffers || []) as any[]).map((combo: any, index: number) => {
                      const currentList = comboOffersDraft || data.comboOffers || [];
                      return (
                        <div
                          key={combo.id}
                          className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[#f0d8de] bg-[#fffdfb]"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-[#2d1e22]">{combo.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#fdf2f4] text-[#9e5461] border border-[#e4b7c0]">
                                {combo.badge}
                              </span>
                            </div>
                            <p className="text-xs text-[#6e5259]">{combo.description}</p>
                            <p className="text-[11px] text-[#5c4349]">
                              Min Items: <strong>{combo.minItems}</strong> · Discount:{' '}
                              <strong>{formatINR(combo.discountPaise)}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2d1e22] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={combo.isActive}
                                onChange={(e) => {
                                  const updated = currentList.map((item: any, i: number) =>
                                    i === index ? { ...item, isActive: e.target.checked } : item
                                  );
                                  setComboOffersDraft(updated);
                                }}
                                className="accent-[#9e5461] rounded"
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const newAmount = prompt(
                                  `Enter discount in Rupees for ${combo.name}:`,
                                  String(paiseToRupees(combo.discountPaise))
                                );
                                if (newAmount !== null && !isNaN(Number(newAmount))) {
                                  const updated = currentList.map((item: any, i: number) =>
                                    i === index ? { ...item, discountPaise: rupeesToPaise(Number(newAmount)) } : item
                                  );
                                  setComboOffersDraft(updated);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg border border-[#e4b7c0] bg-white text-xs text-[#5c4349] hover:bg-[#fdf2f4]"
                            >
                              Edit Discount
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e4b7c0] bg-white p-5 space-y-4">
                  <h3 className="text-base font-semibold text-[#2d1e22]">
                    Active Payment Mode &amp; Merchant Account Eligibility Warning
                  </h3>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
                    <strong>Merchant UPI / Bank Account Warning:</strong> Never assume a personal or minor savings/UPI account is approved for commercial e-commerce transactions. Verify merchant account eligibility with your bank or payment gateway before accepting live customer payments.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {(
                      [
                        {
                          id: 'whatsapp',
                          title: 'A. WhatsApp-Assisted Workflow (Default)',
                          desc: 'Saves order with status awaiting_payment & payment pending, opens WhatsApp click-to-chat, and requires Admin bank verification before confirmation.',
                        },
                        {
                          id: 'manual',
                          title: 'B. Manual Bank/UPI Workflow',
                          desc: 'Shows owner payment instructions. Orders remain Awaiting Verification until owner checks bank statement.',
                        },
                        {
                          id: 'razorpay',
                          title: 'C. Payment Gateway Adapter',
                          desc: 'Requires verified merchant KYC & server-side webhook secret in .env.',
                        },
                        {
                          id: 'demo',
                          title: 'D. Demo Mode',
                          desc: 'Clearly labeled as Demo. Never represents demo orders as real paid orders.',
                        },
                      ] as const
                    ).map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => handleUpdateSettings({ paymentMode: pm.id })}
                        className={`text-left p-4 rounded-xl border transition-colors ${
                          data.settings.general.paymentMode === pm.id
                            ? 'border-[#9e5461] bg-[#fdf2f4]'
                            : 'border-[#e4b7c0] bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold text-[#2d1e22]">{pm.title}</p>
                        <p className="text-[11px] text-[#6e5259] mt-1 leading-relaxed">{pm.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 15. ADMIN USERS & AUDIT LOG */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#2d1e22]">
                  15. Admin Users &amp; Security Audit Log
                </h1>
                <div className="rounded-xl border border-[#e4b7c0] bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs font-tabular">
                    <thead className="bg-[#fdf2f4] text-[#6e5259] border-b border-[#e4b7c0]">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Actor</th>
                        <th className="py-2.5 px-4">Role</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Entity</th>
                        <th className="py-2.5 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5e4e8]">
                      {data.auditLogs.map((log: any) => (
                        <tr key={log.id}>
                          <td className="py-2 px-4">{log.created_at.slice(0, 19).replace('T', ' ')}</td>
                          <td className="py-2 px-4 font-semibold">{log.actor_email}</td>
                          <td className="py-2 px-4 uppercase">{log.actor_role}</td>
                          <td className="py-2 px-4 font-semibold text-[#7a3b47]">{log.action}</td>
                          <td className="py-2 px-4">{log.entity_type}</td>
                          <td className="py-2 px-4 font-mono text-[11px]">{log.details_json}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
