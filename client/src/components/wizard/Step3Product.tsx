import { useState, useEffect, useRef } from "react";
import { type SubmissionInput } from "@shared/routes";
import { type Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Receipt, Percent, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  data: Partial<SubmissionInput>;
  updateData: (data: Partial<SubmissionInput>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3Product({ data, updateData, onNext, onBack }: Props) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const fieldRefs = {
    supplierName: useRef<HTMLDivElement>(null),
    supplierId: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const dealer = user?.username === "info@gorgia.ge" ? "gorgia" : "iron";
        const res = await fetch(`/api/products?dealer=${dealer}`);
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [user?.username]);

  const handleNext = () => {
    const newErrors: Record<string, boolean> = {};
    if (!data.supplierName) newErrors.supplierName = true;
    if (!data.supplierId) newErrors.supplierId = true;
    if (!data.model) newErrors.model = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorField = (Object.keys(newErrors) as Array<keyof typeof fieldRefs>).find(
        (field) => newErrors[field]
      );
      if (firstErrorField && fieldRefs[firstErrorField].current) {
        fieldRefs[firstErrorField].current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    onNext();
  };

  // Calculate pricing whenever model or discount status changes
  useEffect(() => {
    if (!data.model || products.length === 0) return;
    setErrors({}); // Clear error when model is selected

    const selected = products.find((m) => m.id.toString() === data.model || m.name === data.model);
    if (!selected) return;

    const price = selected.price / 100; // Convert cents to GEL

    const now = new Date();
    const discountExpiry = selected.discountExpiry
      ? new Date(selected.discountExpiry as any)
      : null;
    const isDiscountActive = !discountExpiry || !Number.isNaN(discountExpiry.getTime())
      ? !discountExpiry || discountExpiry.getTime() >= now.getTime()
      : true;

    const discountPercentage =
      selected.discountPercentage !== null && selected.discountPercentage !== undefined
        ? Number(selected.discountPercentage)
        : null;
    const discountPrice =
      selected.discountPrice !== null && selected.discountPrice !== undefined
        ? Number(selected.discountPrice) / 100
        : null;

    // Discount logic source-of-truth: Admin Dashboard only.
    // If admin provided a discount and it's active, apply it; otherwise no discount.
    let finalPayable = price;
    let subsidyRate = 0;
    if (isDiscountActive) {
      if (discountPrice !== null && Number.isFinite(discountPrice) && discountPrice >= 0) {
        finalPayable = discountPrice;
        subsidyRate = price > 0 ? 1 - finalPayable / price : 0;
      } else if (discountPercentage !== null && Number.isFinite(discountPercentage) && discountPercentage > 0) {
        subsidyRate = discountPercentage / 100;
        finalPayable = price * (1 - subsidyRate);
      }
    }

    updateData({
      price,
      subsidyRate,
      finalPayable,
    });
  }, [data.model, data.sociallyVulnerable, data.pensioner, products]);

  const isComplete = () => {
    return !!data.supplierName && !!data.supplierId && !!data.model;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">პროდუქტი და ფასები</h2>
        <p className="text-muted-foreground">აირჩიეთ გამყიდველი კომპანია და მოწყობილობის მოდელი საბოლოო გადასახდელის გამოსათვლელად.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2" ref={fieldRefs.supplierName}>
          <Label htmlFor="supplierName" className={cn(errors.supplierName && "text-destructive")}>გამყიდველი კომპანიის სახელი *</Label>
          <Input 
            id="supplierName" 
            placeholder="შეიყვანეთ გამყიდველი კომპანიის სახელი" 
            value={data.supplierName || ""} 
            onChange={(e) => {
              updateData({ supplierName: e.target.value });
              setErrors(prev => ({ ...prev, supplierName: false }));
            }}
            className={cn("h-12 rounded-xl", errors.supplierName && "border-destructive bg-destructive/5")}
          />
        </div>
        <div className="space-y-2" ref={fieldRefs.supplierId}>
          <Label htmlFor="supplierId" className={cn(errors.supplierId && "text-destructive")}>ღუმელის კოდი *</Label>
          <Input 
            id="supplierId" 
            placeholder="შეიყვანეთ ღუმელის კოდი" 
            value={data.supplierId || ""} 
            onChange={(e) => {
              updateData({ supplierId: e.target.value });
              setErrors(prev => ({ ...prev, supplierId: false }));
            }}
            className={cn("h-12 rounded-xl", errors.supplierId && "border-destructive bg-destructive/5")}
          />
        </div>
      </div>

      <div className="pt-4 space-y-4" ref={fieldRefs.model}>
        <Label className={cn("text-lg font-semibold", errors.model && "text-destructive")}>აირჩიეთ მოწყობილობის მოდელი *</Label>
        
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>პროდუქტები იტვირთება...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-border">
            <p className="text-muted-foreground">პროდუქტები ვერ მოიძებნა</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((model) => {
              const isSelected = data.model === model.id.toString() || data.model === model.name;
              const displayPrice = model.price / 100;
              const hasDiscount =
                (model.discountPercentage !== null && model.discountPercentage !== undefined && Number(model.discountPercentage) > 0) ||
                (model.discountPrice !== null && model.discountPrice !== undefined && Number(model.discountPrice) > 0);
              
              return (
                <div 
                  key={model.id}
                  onClick={() => updateData({ model: model.name })}
                  className={cn(
                    "relative p-0 rounded-2xl border-2 cursor-pointer transition-all duration-300 overflow-hidden group",
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.02]" 
                      : "border-border hover:border-primary/40 hover:bg-muted/30 hover:shadow-md"
                  )}
                >
                  {model.imageUrl ? (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-white/50 relative">
                      <img 
                        src={model.imageUrl} 
                        alt={model.name}
                        className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className={cn(
                        "absolute inset-0 transition-opacity duration-300",
                        isSelected ? "bg-primary/5 opacity-100" : "bg-black/0 group-hover:bg-black/5 opacity-0 group-hover:opacity-100"
                      )} />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center">
                      <Receipt className="w-12 h-12 text-muted-foreground/20" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{model.name}</div>
                    <div className="text-2xl font-bold text-primary">{displayPrice} <span className="text-sm font-normal text-muted-foreground">GEL</span></div>
                  </div>
                  
                  {hasDiscount && (
                    <div className="absolute top-3 right-3 z-10 bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <Percent className="w-3 h-3" />
                      {model.discountPercentage !== null && model.discountPercentage !== undefined
                        ? `${model.discountPercentage}%`
                        : "%"}
                    </div>
                  )}
                  
                  {isSelected && (
                    <motion.div 
                      layoutId="active-check"
                      className="absolute bottom-3 right-3 bg-primary text-primary-foreground rounded-full p-1 shadow-sm"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data.model && data.price !== undefined && data.subsidyRate !== undefined && data.finalPayable !== undefined && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-foreground text-background p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-background/20 rounded-xl">
              <Receipt className="w-8 h-8 text-background" />
            </div>
            <div>
              <h4 className="text-background/80 font-medium">ფასების შეჯამება</h4>
              <p className="text-sm">
                <span className="text-background/80">საწყისი ფასი: </span>
                <span className="line-through decoration-background/60">
                  {data.price} GEL
                </span>
              </p>
            </div>
          </div>
          
          <div className="h-px w-full sm:w-px sm:h-12 bg-background/20 hidden sm:block"></div>
          
          <div className="text-center sm:text-left">
            <h4 className="text-background/80 font-medium mb-1">ფასდაკლება</h4>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-semibold">
              <Percent className="w-3.5 h-3.5" /> {(data.subsidyRate * 100).toFixed(0)}%
            </div>
          </div>

          <div className="h-px w-full sm:w-px sm:h-12 bg-background/20 hidden sm:block"></div>

          <div className="text-center sm:text-right">
            <h4 className="text-background/80 font-medium mb-1">საბოლოო ფასი</h4>
            <div className="text-3xl font-extrabold text-primary-foreground">{data.finalPayable.toFixed(2)} GEL</div>
          </div>
        </motion.div>
      )}

      <div className="pt-6 flex justify-between">
        <Button variant="outline" onClick={onBack} className="px-8 h-12 rounded-xl text-base">უკან</Button>
        <Button onClick={handleNext} className="px-8 h-12 rounded-xl text-base shadow-md">გაგრძელება</Button>
      </div>
    </motion.div>
  );
}
