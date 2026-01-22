import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Client } from '../types/client';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ClientModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    initialData?: Client;
}

export default function ClientModal({ open, onClose, onSave, initialData }: ClientModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'client' as 'client' | 'reseller',
        email: '',
        telegram: '',
        discord: '',
        notes: '',
        source: ''
    });

    // Track if modal was previously open to avoid resetting on browser tab switch
    const wasOpen = useRef(false);
    const lastInitialDataId = useRef<string | null>(null);

    // Reset form data when modal opens or initialData changes
    useEffect(() => {
        // Only initialize form when modal transitions from closed to open
        // Or when editing a different client
        const isNewOpen = open && !wasOpen.current;
        const isDifferentClient = initialData?.id !== lastInitialDataId.current;

        if (isNewOpen || (open && isDifferentClient)) {
            setFormData({
                name: initialData?.name ?? '',
                type: initialData?.type ?? 'client',
                email: initialData?.email ?? '',
                telegram: initialData?.telegram ?? '',
                discord: initialData?.discord ?? '',
                notes: initialData?.notes ?? '',
                source: initialData?.source ?? ''
            });
            lastInitialDataId.current = initialData?.id ?? null;
        }

        wasOpen.current = open;
    }, [open, initialData]);

    // Keyboard shortcuts: Enter to save, Escape to close
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't trigger if typing in an input/textarea
            if (shouldIgnoreKeyboardEvent(event) && event.key !== 'Escape') {
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                const form = document.querySelector('form');
                if (form) {
                    form.requestSubmit();
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(formData);
            onClose();
        } catch (error: any) {
            console.error('Error in client modal:', error);
            alert(error.message || 'Failed to save client. Please check if all required fields are filled correctly.');
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold text-foreground">
                        {initialData ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <Label className="text-muted-foreground">Client Type</Label>
                        <div className="flex gap-6 mt-3">
                            <label className="inline-flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="client"
                                    checked={formData.type === 'client'}
                                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'client' | 'reseller' }))}
                                    className="text-primary focus:ring-ring h-4 w-4 bg-secondary border-border"
                                />
                                <span className="ml-2 text-sm font-medium text-foreground">Normal Client</span>
                            </label>
                            <label className="inline-flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="reseller"
                                    checked={formData.type === 'reseller'}
                                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'client' | 'reseller' }))}
                                    className="text-primary focus:ring-ring h-4 w-4 bg-secondary border-border"
                                />
                                <span className="ml-2 text-sm font-medium text-foreground">Reseller</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="name" className="text-muted-foreground">Name</Label>
                        <Input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="mt-2"
                            placeholder="Enter client name"
                            value={formData.name}
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                        <Input
                            type="email"
                            name="email"
                            id="email"
                            className="mt-2"
                            placeholder="client@example.com"
                            value={formData.email}
                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="telegram" className="text-muted-foreground">Telegram</Label>
                        <Input
                            type="text"
                            name="telegram"
                            id="telegram"
                            className="mt-2"
                            placeholder="@username"
                            value={formData.telegram}
                            onChange={e => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="discord" className="text-muted-foreground">Discord</Label>
                        <Input
                            type="text"
                            name="discord"
                            id="discord"
                            className="mt-2"
                            placeholder="username#1234"
                            value={formData.discord}
                            onChange={e => setFormData(prev => ({ ...prev, discord: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="source" className="text-muted-foreground">How did they find you?</Label>
                        <Input
                            type="text"
                            name="source"
                            id="source"
                            className="mt-2"
                            placeholder="e.g. Google, Referral, Social Media"
                            value={formData.source}
                            onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="notes" className="text-muted-foreground">Notes</Label>
                        <Textarea
                            name="notes"
                            id="notes"
                            rows={3}
                            className="mt-2"
                            placeholder="Additional notes about this client..."
                            value={formData.notes}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        />
                    </div>
                    <div className="flex gap-3 pt-6 border-t border-border">
                        <Button type="submit" className="flex-1">
                            Save Client
                        </Button>
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
