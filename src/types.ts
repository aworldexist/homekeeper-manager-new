export const categories = ['食品', '饮料', '调味品', '清洁用品', '洗护用品', '日用品', '其他'] as const;
export type Category = typeof categories[number];
export type StorageMode = 'room' | 'fridge' | 'freezer';
export interface ExpiryEstimate {
    date: string;
    basisDate: string;
    basisName: string;
    basisLocation: string;
    storage: StorageMode;
    days: number;
    ruleLabel: string;
    source: string;
    profileId?: string;
    basisKind?: 'purchase' | 'production' | 'opened' | 'cut';
    basisLabel?: string;
    sourceSheet?: string;
    sourceRow?: number;
    referenceRange?: string;
    referenceNote?: string;
    maxDate?: string;
    qualityOnly?: boolean;
}
export interface Item {
    id: string;
    name: string;
    category: Category;
    quantity: number;
    unit: string;
    location: string;
    purchaseDate: string;
    expiryDate: string;
    expiryEstimate?: ExpiryEstimate;
    minimum: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
}
export type ItemDraft = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;
export interface Movement {
    id: string;
    itemId: string;
    name: string;
    delta: number;
    unit: string;
    reason: string;
    time: string;
}
export interface ShoppingItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: Category;
    source: string;
    completed: boolean;
}
export interface Store {
    version: 1;
    items: Item[];
    shopping: ShoppingItem[];
    locations: string[];
    movements: Movement[];
}
export interface Ingredient {
    name: string;
    quantity: number;
    unit: string;
    amountText?: string;
    approximate?: boolean;
}
export interface FlexibleIngredient {name:string;amountText:string;role:'main'|'seasoning'}
export interface Recipe {
    id: string;
    name: string;
    minutes: number;
    tags: string[];
    ingredients: Ingredient[];
    steps: string[];
    color: string;
    kind: 'soup' | 'noodle' | 'rice' | 'salad' | 'stir';
    aliases?: string[];
    section?: string;
    tip?: string;
    flexibleIngredients?: FlexibleIngredient[];
    userProvided?: boolean;
}
export type Page = 'overview' | 'items' | 'entry' | 'expiry' | 'locations' | 'shopping' | 'recipes' | 'assistant' | 'settings';
