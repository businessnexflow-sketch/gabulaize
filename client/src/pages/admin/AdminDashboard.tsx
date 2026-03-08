import { useState, useEffect } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Tag, Trash2, Search, LogOut, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Product } from "@shared/schema";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { logout } = useAdminAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const [dealer, setDealer] = useState<"iron" | "gorgia">(
    (localStorage.getItem("admin_dealer") as any) || "iron",
  );

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    imageUrl: "",
    stock: "0",
  });

  // Edit Price State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newPrice, setNewPrice] = useState("");

  // Discount State
  const [discountingProduct, setDiscountingProduct] = useState<Product | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountExpiry, setDiscountExpiry] = useState("");

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/admin/products?dealer=${dealer}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      toast({ title: "შეცდომა", description: "პროდუქტების ჩატვირთვა ვერ მოხერხდა", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [dealer]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingProduct(true);
    try {
      const res = await fetch(`/api/admin/products?dealer=${dealer}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({
          ...newProduct,
          price: Math.round(parseFloat(newProduct.price) * 100), // convert to cents
          stock: parseInt(newProduct.stock),
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      toast({ title: "წარმატებით", description: "პროდუქტი წარმატებით დაემატა" });
      setNewProduct({ name: "", description: "", price: "", category: "", imageUrl: "", stock: "0" });
      fetchProducts();
    } catch (err) {
      toast({ title: "შეცდომა", description: "პროდუქტის დამატება ვერ მოხერხდა", variant: "destructive" });
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!editingProduct) return;
    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}/price?dealer=${dealer}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({ price: Math.round(parseFloat(newPrice) * 100) }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "წარმატებით", description: "ფასი განახლდა" });
      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      toast({ title: "შეცდომა", description: "განახლება ვერ მოხერხდა", variant: "destructive" });
    }
  };

  const handleSetDiscount = async () => {
    if (!discountingProduct) return;
    try {
      let discountPrice = discountingProduct.price;
      let percentage = 0;

      if (discountType === "percentage") {
        percentage = parseInt(discountValue);
        discountPrice = Math.round(discountingProduct.price * (1 - percentage / 100));
      } else {
        const fixed = Math.round(parseFloat(discountValue) * 100);
        discountPrice = Math.max(0, discountingProduct.price - fixed);
        percentage = Math.round(((discountingProduct.price - discountPrice) / discountingProduct.price) * 100);
      }

      const res = await fetch(`/api/admin/products/${discountingProduct.id}/discount?dealer=${dealer}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({
          discountPrice,
          discountPercentage: percentage,
          discountExpiry: discountExpiry || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to set discount");
      toast({ title: "წარმატებით", description: "ფასდაკლება დაემატა" });
      setDiscountingProduct(null);
      fetchProducts();
    } catch (err) {
      toast({ title: "შეცდომა", description: "ფასდაკლების დაყენება ვერ მოხერხდა", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("დარწმუნებული ხართ?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}?dealer=${dealer}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (!res.ok) throw new Error("წაშლა ვერ მოხერხდა");
      toast({ title: "წაიშალა", description: "პროდუქტი წაიშალა" });
      fetchProducts();
    } catch (err) {
      toast({ title: "შეცდომა", description: "წაშლა ვერ მოხერხდა", variant: "destructive" });
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Package className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">ადმინ პანელი</h1>
              <p className="text-muted-foreground">პროდუქტების და ფასების მართვა</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Dealer</Label>
              <select
                value={dealer}
                onChange={(e) => {
                  const next = e.target.value as any;
                  setDealer(next);
                  localStorage.setItem("admin_dealer", next);
                  setIsLoading(true);
                }}
                className="h-11 rounded-xl border-2 bg-background px-3 text-sm"
              >
                <option value="iron">Iron+</option>
                <option value="gorgia">Gorgia</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation("/login")}
              className="h-11 rounded-xl border-2"
            >
              დილერის ლოგინი
            </Button>
            <Button variant="outline" onClick={logout} className="h-11 rounded-xl border-2">
              <LogOut className="w-4 h-4 mr-2" /> გასვლა
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Product Form */}
          <Card className="lg:col-span-1 border-2 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-xl flex items-center gap-2">
                <Plus className="w-5 h-5" /> ახალი პროდუქტის დამატება
              </CardTitle>
              <CardDescription>შეიყვანეთ პროდუქტის მონაცემები მარაგში დასამატებლად</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="space-y-2">
                  <Label>პროდუქტის სახელი</Label>
                  <Input 
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>აღწერა</Label>
                  <Textarea 
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                    required
                    className="min-h-[100px] rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ფასი (₾)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>მარაგი</Label>
                    <Input 
                      type="number"
                      value={newProduct.stock}
                      onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>კატეგორია</Label>
                  <Input 
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>სურათის URL</Label>
                  <Input 
                    value={newProduct.imageUrl}
                    onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/10" disabled={isAddingProduct}>
                  {isAddingProduct ? <Loader2 className="animate-spin" /> : "პროდუქტის დამატება"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Product List */}
          <Card className="lg:col-span-2 border-2 shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">პროდუქტების სია</CardTitle>
                <CardDescription>ფასების და ფასდაკლებების მართვა</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="ძიება..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-background"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="pl-6">პროდუქტი</TableHead>
                    <TableHead>ფასი</TableHead>
                    <TableHead>მარაგი</TableHead>
                    <TableHead className="pr-6 text-right">ქმედებები</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} className="group hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6">
                          <div className="font-semibold">{product.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</div>
                          {product.discountPercentage && (
                            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">
                              SALE {product.discountPercentage}%
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold flex items-center gap-1">
                            {product.discountPrice ? (
                              <>
                                <span className="line-through text-muted-foreground text-xs">{(product.price / 100).toFixed(2)}</span>
                                <span className="text-red-600">{(product.discountPrice / 100).toFixed(2)}</span>
                              </>
                            ) : (
                              (product.price / 100).toFixed(2)
                            )}
                            <span className="text-[10px] text-muted-foreground">GEL</span>
                          </div>
                        </TableCell>
                        <TableCell>{product.stock}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Dialog open={editingProduct?.id === product.id} onOpenChange={(open) => !open && setEditingProduct(null)}>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => { setEditingProduct(product); setNewPrice((product.price / 100).toString()); }} className="h-8 w-8 rounded-lg">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="rounded-3xl">
                                <DialogHeader>
                                  <DialogTitle>ფასის განახლება: {product.name}</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                  <div className="space-y-2">
                                    <Label>ახალი ფასი (₾)</Label>
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      value={newPrice}
                                      onChange={e => setNewPrice(e.target.value)}
                                      className="h-12 rounded-xl text-lg font-bold"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={handleUpdatePrice} className="w-full h-12 rounded-xl font-bold">შენახვა</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Dialog open={discountingProduct?.id === product.id} onOpenChange={(open) => !open && setDiscountingProduct(null)}>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => { setDiscountingProduct(product); setDiscountValue(""); }} className="h-8 w-8 rounded-lg text-orange-600">
                                  <Tag className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="rounded-3xl">
                                <DialogHeader>
                                  <DialogTitle>ფასდაკლების დაყენება: {product.name}</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                                    <Button 
                                      variant={discountType === "percentage" ? "default" : "ghost"} 
                                      size="sm" 
                                      onClick={() => setDiscountType("percentage")}
                                      className="rounded-lg"
                                    >პროცენტული</Button>
                                    <Button 
                                      variant={discountType === "fixed" ? "default" : "ghost"} 
                                      size="sm" 
                                      onClick={() => setDiscountType("fixed")}
                                      className="rounded-lg"
                                    >ფიქსირებული</Button>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{discountType === "percentage" ? "ფასდაკლება (%)" : "ფასდაკლება (₾)"}</Label>
                                    <Input 
                                      type="number"
                                      value={discountValue}
                                      onChange={e => setDiscountValue(e.target.value)}
                                      className="h-12 rounded-xl text-lg font-bold"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>ვადის გასვლა (არასავალდებულო)</Label>
                                    <Input 
                                      type="date"
                                      value={discountExpiry}
                                      onChange={e => setDiscountExpiry(e.target.value)}
                                      className="h-12 rounded-xl"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={handleSetDiscount} className="w-full h-12 rounded-xl font-bold bg-orange-600 hover:bg-orange-700">დაყენება</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(product.id)} className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
              {isLoading && (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              )}
              {!isLoading && filteredProducts.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  თქვენი ძიების მიხედვით პროდუქტები ვერ მოიძებნა.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
