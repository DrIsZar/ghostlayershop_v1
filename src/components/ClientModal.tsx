import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Client } from '../types/client';

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

    // Reset form data when modal opens or initialData changes
    useEffect(() => {
        if (open) {
            setFormData({
                name: initialData?.name ?? '',
                type: initialData?.type ?? 'client',
                email: initialData?.email ?? '',
                telegram: initialData?.telegram ?? '',
                discord: initialData?.discord ?? '',
                notes: initialData?.notes ?? '',
                source: initialData?.source ?? ''
            });
        }
    }, [open, initialData]);

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

    return (
        <Transition.Root show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                                <div className="absolute right-0 top-0 pr-4 pt-4">
                                    <button
                                        type="button"
                                        className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-300"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Close</span>
                                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                        <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-white">
                                            {initialData ? 'Edit Client' : 'Add New Client'}
                                        </Dialog.Title>
                                        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-white mb-2">
                                                    Type
                                                </label>
                                                <div className="flex gap-4">
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="type"
                                                            value="client"
                                                            checked={formData.type === 'client'}
                                                            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'client' | 'reseller' }))}
                                                            className="text-indigo-600 focus:ring-indigo-600 h-4 w-4 bg-white/5 border-0"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-300">Normal Client</span>
                                                    </label>
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="type"
                                                            value="reseller"
                                                            checked={formData.type === 'reseller'}
                                                            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'client' | 'reseller' }))}
                                                            className="text-indigo-600 focus:ring-indigo-600 h-4 w-4 bg-white/5 border-0"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-300">Reseller</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-white">
                                                    Name
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    id="name"
                                                    required
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 px-3 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                    value={formData.name}
                                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="email" className="block text-sm font-medium text-white">
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    id="email"
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 px-3 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                    value={formData.email}
                                                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="telegram" className="block text-sm font-medium text-white">
                                                    Telegram
                                                </label>
                                                <input
                                                    type="text"
                                                    name="telegram"
                                                    id="telegram"
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 px-3 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                    value={formData.telegram}
                                                    onChange={e => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="discord" className="block text-sm font-medium text-white">
                                                    Discord
                                                </label>
                                                <input
                                                    type="text"
                                                    name="discord"
                                                    id="discord"
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 px-3 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                    value={formData.discord}
                                                    onChange={e => setFormData(prev => ({ ...prev, discord: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="source" className="block text-sm font-medium text-white">
                                                    How did they find you?
                                                </label>
                                                <input
                                                    type="text"
                                                    name="source"
                                                    id="source"
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 px-3 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                    value={formData.source}
                                                    onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="notes" className="block text-sm font-medium text-white">
                                                    Notes
                                                </label>
                                                <textarea
                                                    name="notes"
                                                    id="notes"
                                                    rows={3}
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 px-3 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                    value={formData.notes}
                                                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                                />
                                            </div>
                                            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                                <button
                                                    type="submit"
                                                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10 hover:bg-white/20 sm:mt-0 sm:w-auto"
                                                    onClick={onClose}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
