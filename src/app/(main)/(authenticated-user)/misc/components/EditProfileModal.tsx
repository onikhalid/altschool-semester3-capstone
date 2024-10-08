'use client'

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z, ZodError } from 'zod';
import { getDoc, doc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import toast from 'react-hot-toast';

import { Button, Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, FormError, Input, LoadingModal, Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, TagInput, Textarea } from '@/components/ui';
import { SmallSpinner, TrashIcon, UploadIcon } from '@/components/icons';
import { auth, db, } from '@/utils/firebaseConfig';
import { zodResolver } from '@hookform/resolvers/zod';
import { presetArticleTags } from '@/constants';
import { TUser } from '@/contexts';
import { cn } from '@/lib/utils';

import { generateTitleSearchTerms } from '@/app/(main)/(authenticated-user)/new/misc/utils';
import { useUpdateUserProfile } from '@/app/(auth)/misc/api';
import { checkIfUsernameTaken } from '@/app/(auth)/misc/utils';
import { TUpdateUser } from '@/app/(auth)/misc/types';
import { updateProfile } from 'firebase/auth';





interface Props {
    isModalOpen: boolean
    closeModal: () => void
    userData: TUser | null | undefined
    isUserDataLoading: boolean
}
const EditProfileModal: React.FC<Props> = ({ isModalOpen, closeModal, userData, isUserDataLoading }) => {
    const [user, loading] = useAuthState(auth);
    const router = useRouter();
    const [profileImgURL, setProfileImgURL] = useState<string | null>(null)
    const [selectedImage, setSelectedImage] = useState<File | null>(null)
    const OnboardingForm = z.object({
        name: z.string({ required_error: 'Enter your name' }).min(3, { message: 'Name must be at least 3 characters' }),
        username: z.string({ required_error: 'Enter username' }).min(5, { message: 'Username must be at least 5 characters' }),
        interests: z.array(z.string()).min(3, { message: 'Please select at least three interest' }),
        bio: z.string({ required_error: 'Enter bio' }).min(20, { message: 'Bio must be at least 20 characters' }),
        twitter: z.string().optional(),
        facebook: z.string().optional(),
        linkedin: z.string().optional(),
        instagram: z.string().optional(),
        avatar: z.any().nullable().refine(
            file => {
                if (!userData?.avatar && !user?.photoURL && !file) {
                    throw ZodError.create([{
                        path: ['avatar'],
                        message: 'Please select a profile image.',
                        code: 'custom',
                    }]);
                }
                if (file && !file.type.startsWith('image/')) {
                    throw ZodError.create([{
                        path: ['avatar'],
                        message: 'Please select a valid image file.',
                        code: 'custom',
                    }]);
                }
                if (file) {
                    return file?.size <= 10000000
                }
                else {
                    return !!userData?.avatar
                }
            },

            {
                message: 'Max image size is 10MB.',
            }
        ),
    });
    const { handleSubmit, register, formState: { errors }, control, watch, setError, setValue } = useForm<TUpdateUser>({
        resolver: zodResolver(OnboardingForm)
    });

    useEffect(() => {
        if (!isUserDataLoading && userData) {

            setValue('name', userData.name || '')
            setValue('username', userData.username || '')
            setValue('bio', userData.bio || '')
            setValue('interests', userData.interests || [])
            setValue('twitter', userData.twitter || '')
            setValue('facebook', userData.facebook || '')
            setValue('linkedin', userData.linkedin || '')
            setValue('instagram', userData.instagram || '')
            setProfileImgURL(userData.avatar || user?.photoURL || null)
        }
    }, [userData, isUserDataLoading, setValue, user?.photoURL])



    const updateUserProfileMutation = useUpdateUserProfile({ user: user!, selectedImage, profileImgURL: profileImgURL! });
    const handleUpdateProfile = async (data: TUpdateUser) => {
        if (!isUserDataLoading && !userData) {
            toast.error("Login to update profile")
            return
        }
        const validUsername = await checkIfUsernameTaken({ username: data.username, user: user! });
        if (!validUsername) {
            setError('username', { message: 'Username already taken' })
            return
        }

        try {

            await updateUserProfileMutation.mutateAsync({ ...data, updated_at: new Date(), name_for_search: generateTitleSearchTerms(data.name) },
                {
                    onSuccess() {
                        toast.success("Profile updated successfully", {
                            position: "top-center",
                            duration: 2000,
                        });
                        closeModal()
                    },
                }
            );

        } catch (error) {
            console.error(error);
            toast.error("Failed to update profile", {
                position: "top-center",
                duration: 2000,
            });
        }
    };


    const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files![0];
        setSelectedImage(file);
        const newImgURL = URL.createObjectURL(file)
        setProfileImgURL(newImgURL)
    };




    return (
        <Sheet open={isModalOpen} onOpenChange={closeModal}>

            <SheetContent className='w-[90vw] overflow-scroll max-w-lg'>
                <SheetHeader className='sticky top-0 z-10 flex flex-row items-center justify-between w-full'>
                    <SheetTitle>Edit Profile</SheetTitle>
                    <SheetClose className="">
                        <Button variant='secondary'>
                            Close
                        </Button>
                    </SheetClose>
                </SheetHeader>
                <article className='bg-background p-6 rounded-3xl max-md:rounded-b-none mx-auto w-full max-w-[525px] '>
                    <header className='text-center'>
                        <h1 className='font-bold font-display text-primary text-2xl'>Edit your Chattter profile</h1>
                        <p className='text-muted-foreground text-sm text-balance'>Edit the details of your profile to help us fine tune a rich and personalized experience for you🤝</p>
                    </header>

                    <form onSubmit={handleSubmit(handleUpdateProfile)} className='flex flex-col gap-6 mt-12 md:mt-16'>

                        <Controller
                            name="avatar"
                            control={control}
                            render={({ field }) => (
                                <label
                                    className={cn('flex flex-col items-center justify-start min-h-20 w-full rounded-lg overflow-hidden',)}
                                    htmlFor='avatar'
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        id="avatar"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                field.onChange(file);
                                                handleImageSelect(e);
                                            }
                                        }}
                                        className='hidden'
                                    />
                                    {
                                        !watch('avatar') && !userData?.avatar && !profileImgURL &&
                                        <div className={cn('flex items-center justify-center bg-muted aspect-video w-full cursor-pointer border-2 border-transparent',
                                            errors.avatar && 'border-red-500'
                                        )}>
                                            <UploadIcon className='fill-muted-foreground text-muted-foreground' />
                                        </div>
                                    }

                                    {
                                        (selectedImage || profileImgURL || watch('avatar')) &&
                                        <div className='relative w-full aspect-video'>
                                            <Image
                                                className=''
                                                src={(() => {
                                                    if (userData?.avatar && !selectedImage && !profileImgURL) {
                                                        return userData?.avatar
                                                    }
                                                    else {
                                                        return profileImgURL || ""
                                                    }
                                                })()}
                                                alt="Preview"
                                                objectFit='cover'
                                                fill
                                            />

                                            <div className='absolute right-0 flex items-center px-4 rounded-lg p-2'>
                                                <Button variant='outline' shape='rounded' className='flex items-center gap-2'
                                                    onClick={() => {
                                                        setSelectedImage(null)
                                                        setProfileImgURL(null)
                                                        setValue('avatar', null)
                                                    }}
                                                >
                                                    <TrashIcon fill='red' />
                                                </Button>

                                            </div>
                                        </div>
                                    }
                                    {errors.avatar && <FormError errorMessage={errors.avatar?.message as string} className='mb-8' />}

                                </label>
                            )}
                        />




                        <Input
                            type="text"
                            placeholder="Name"
                            className='3.875rem'
                            {...register('name')}
                            hasError={!!errors.name}
                            errorMessage={errors.name?.message}
                        />
                        <Input
                            type="text"
                            placeholder="Choose username"
                            {...register('username')}
                            className='3.875rem'
                            hasError={!!errors.username}
                            errorMessage={errors.username?.message}
                        />


                        <Textarea
                            placeholder="Tell us about yourself"
                            {...register('bio')}
                            hasError={!!errors.bio}
                            errorMessage={errors.bio?.message}
                            rows={7}
                            showCharacterCount
                            maxLength={300}
                            currentLength={watch('bio')?.length || 0}
                        />

                        <Controller
                            name="interests"
                            control={control}
                            render={({ field }) => (
                                <TagInput
                                    presetTags={presetArticleTags}
                                    selectedTags={field.value || []}
                                    onTagsChange={field.onChange}
                                    className='mt-0 mb-1'
                                    hasError={!!errors.interests}
                                    errorMessage={errors.interests?.message}
                                    triggerclassName="!py-6"
                                    selectedClassName="gap-3"
                                />
                            )}
                        />

                        <section>
                            <h5 className='mt-3 mb-1.5'>
                                Socials {" "}
                                <span className='text-muted-foreground'>(optional)</span>
                            </h5>
                            <div className='flex flex-col gap-5'>
                                <Input
                                    type="text"
                                    placeholder="Twitter"
                                    {...register('twitter')}
                                />
                                <Input
                                    type="text"
                                    placeholder="Facebook"
                                    {...register('facebook')}
                                />
                                <Input
                                    type="text"
                                    placeholder="Linkedin"
                                    {...register('linkedin')}
                                />
                                <Input
                                    type="text"
                                    placeholder="Instagram"
                                    {...register('instagram')}
                                />
                            </div>
                        </section>


                        <Button type="submit" className='w-full flex items-center gap-2 bg-[#5574FB] mt-6' size="cta">
                            Update Profile
                            {
                                updateUserProfileMutation.isPending && <SmallSpinner className='text-primary' />
                            }
                        </Button>
                    </form>
                </article>

                <LoadingModal
                    isModalOpen={updateUserProfileMutation.isPending}
                    errorMsg={'Please have patience while we update your profile'}
                />
            </ SheetContent>
        </Sheet>

    );
};

export default EditProfileModal;
