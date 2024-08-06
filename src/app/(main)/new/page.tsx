'use client'

import React, { Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Controller, set, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import 'react-quill/dist/quill.snow.css';

import { Avatar, Button, ChatterLogo, FormError, Input, LinkButton, LoadingModal, Popover, PopoverContent, PopoverTrigger, TagInput } from '@/components/ui'
import { auth, storage } from '@/utils/firebaseConfig';
import { zodResolver } from '@hookform/resolvers/zod';
import { getInitials } from '@/utils/strings';
import { PenIcon, TrashIcon, UploadIcon, ViewIcon } from '@/components/icons';
import { ThemeContext, UserContext } from '@/contexts';
import { cn } from '@/lib/utils';
import { presetArticleTags } from '@/constants';
import { UseCreateNewPost, UseGetPostDetails, UseUpdateNewPost } from './misc/api';
import { deleteImageFromDatabase, extractImageUrl, findDeletedImage, uploadCoverImage } from './misc/utils';
import { CreateNewPostFormSchema } from './misc/schemas';





type createNewPostFormDataType = z.infer<typeof CreateNewPostFormSchema>

const WriteNewStoryPage = () => {
    const params = useSearchParams()
    const [user, loading] = useAuthState(auth);
    const { theme } = useContext(ThemeContext);
    const { userData } = useContext(UserContext);

    const postToEditId = params.get('edit');
    const { data: postData, isLoading: isFetchingPostData } = UseGetPostDetails(postToEditId)
    const { mutate: createPost, isPending: isCreatingPost } = UseCreateNewPost()
    const { mutate: updatePost, isPending: isUpdatingPost } = UseUpdateNewPost()

    const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });






    const {
        register, control, handleSubmit, setValue, watch, setError, clearErrors, formState: { isValid, errors }, reset
    } = useForm<createNewPostFormDataType>({
        resolver: zodResolver(CreateNewPostFormSchema),
        defaultValues: {
            content: postData?.content || "",
            title: postData?.title || "",
            tags: postData?.tags || [],
        },
        mode: "onBlur",
    });
    useEffect(() => {
        if (postData) {
            setValue('title', postData.title)
            setValue('tags', postData.tags)
            setValue('content', postData.content)
            setCoverImgURL(postData.cover_image)
        }
    }, [isFetchingPostData, postData, setValue])

    const [selectedImage, setSelectedImage] = useState<File | null>(watch('cover_image') ?? null);
    const [coverImgURL, setCoverImgURL] = useState<string | null>(postData?.cover_image || null)
    const [deletedImages, setDeletedImages] = useState<string[]>([])





    const handleCreateNewPost = async (data: createNewPostFormDataType) => {
        const submittedData = data;
        const dataToSubmit = {
            ...data,
            author_id: user?.uid,
            author_avatar: userData?.profilePicture || "",
            author_username: userData?.username || "",
            created_at: postData?.created_at || new Date(),
            title_for_search: data.title.split(/[,:.\s-]+/).filter(word => word !== ''),
            cover_image: postData?.cover_image || "",
        };

        if (postToEditId) {
            updatePost({ ...dataToSubmit, post_id: postToEditId }, {
                onSuccess: async (data) => {

                    deletedImages.filter((imageUrl) => submittedData?.content.includes(imageUrl));
                    for (const imageUrl of deletedImages) {
                        deleteImageFromDatabase(imageUrl);
                    }
                    if (selectedImage) {
                        await uploadCoverImage({ imageFile: selectedImage!, postId: postToEditId });
                    }
                    reset();
                },
                onError: (error) => {
                    console.error('Error updating post:', error);
                }
            });
        }

        else {
            createPost(dataToSubmit, {
                onSuccess: async (data) => {
                    console.log(data, 'Post created successfully');
                    const newDocId = data?.id as string || "";

                    console.log(`New post ID: ${newDocId}`);

                    deletedImages.filter((imageUrl) => submittedData?.content.includes(imageUrl));
                    for (const imageUrl of deletedImages) {
                        deleteImageFromDatabase(imageUrl);
                    }
                    await uploadCoverImage({ imageFile: selectedImage!, postId: newDocId });
                    reset();
                },
                onError: (error) => {
                    console.error('Error creating post:', error);
                }
            });
        }

    };




    const QuillimageSelectionHandler = useCallback(async () => {
        const handleImageUpload = async (file: File): Promise<string> => {
            if (!loading && !user?.uid) {
                throw new Error("User not authenticated");
            }
            const storageRef = ref(storage, `post_images/${user?.uid}/${file.name}`);

            try {
                const snapshot = await uploadBytes(storageRef, file, {
                    contentType: file.type,
                    customMetadata: {
                        // Add any additional metadata you need for the image
                    },
                });

                const downloadURL = await getDownloadURL(snapshot.ref);
                return downloadURL;
            } catch (error) {
                console.error(error);
                throw new Error("Image upload failed.");
            }
        };

        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const downloadURL = await handleImageUpload(file);
                const prevContent = watch('content')
                setValue('content', prevContent + `<img src="${downloadURL}" alt="image" />`)
            }
        };
        document.body.appendChild(input);
        document.body.removeChild(input);

    }, [setValue, user?.uid, watch, loading]);

    const QuillModules = {
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image'],
                [{ 'align': [] }],
                ['clean']
            ],
            handlers: {
                image: QuillimageSelectionHandler
            }
        },
        clipboard: {
            matchVisual: false,
        },
    };

    const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files![0];
        setSelectedImage(file);
        const newImgURL = URL.createObjectURL(file)
        setCoverImgURL(newImgURL)
    };



    if (isFetchingPostData) {
        return (<LoadingModal
            isModalOpen={ isFetchingPostData}
            errorMsg='Please wait while we fetch the post data'
        />)
    }





    


    return (
        <main className="flex flex-col h-screen items-center justify-between font-display overflow-hidden">
            <header className="sticky top-0 flex items-center justify-between w-full px-5 py-3 md:px-10 md:py-4 border-b-[0.3px] border-b-[#E4E7EC]">
                <ChatterLogo />
                <section className='flex items-center gap-2'>
                    <Button shape='rounded' className='flex items-center gap-2 rounded-lg py-1.5' type='submit' form="form">
                        {
                            postToEditId ?
                                "Update"
                                :
                                "Submit"
                        }
                        <PenIcon color='lightblue' />
                    </Button>

                    <Popover>
                        <PopoverTrigger>
                            <Avatar alt='' fallback={getInitials(user?.displayName! || "")} src={user?.photoURL} />
                        </PopoverTrigger>
                        <PopoverContent>
                            <div>
                                <span className="text-sm">Signed in as</span>
                                <h6 className="font-semibold">{user?.displayName}</h6>
                            </div>
                        </PopoverContent>
                    </Popover>
                </section>
            </header>

            <div className="grow flex items-start justify-center w-full px-4 lg:px-[7.5vw] lg:gap-[5vw] max-h-[calc(100vh_-_4.5rem)] pt-8 overflow-scroll">
                <form action="" onSubmit={handleSubmit(handleCreateNewPost)} className=' w-full max-w-[1000px]' id='form'>

                    <Input
                        className='!border-none font-display text-4xl xl:text-5xl mb-4 font-bold focus:border-none placeholder:!text-[#B6B5B5] focus-visible:border-none text-center'
                        {...register('title')}
                        placeholder='Title'
                        hasError={!!errors.title}
                        errorMessage={errors.title?.message}
                        errorMessageClass='mb-8 text-center rounded-lg'
                    />



                    <Controller
                        name="cover_image"
                        control={control}
                        render={({ field }) => (
                            <label
                                className={cn('flex flex-col items-center justify-start min-h-20 w-full rounded-lg overflow-hidden',)}
                                htmlFor='cover_image'
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    id="cover_image"
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
                                    !watch('cover_image') && !postData?.cover_image &&
                                    <div className={cn('flex items-center justify-center bg-muted aspect-video w-full cursor-pointer border-2 border-transparent',
                                        errors.cover_image && 'border-red-500'
                                    )}>
                                        <UploadIcon />
                                    </div>
                                }

                                {
                                    (selectedImage || coverImgURL || watch('cover_image')) &&
                                    <div className='relative w-full aspect-video'>
                                        <Image
                                            className=''
                                            src={
                                                (() => {
                                                    if (postData?.cover_image && !selectedImage && !coverImgURL) {
                                                        return postData?.cover_image
                                                    }
                                                    else {
                                                        return coverImgURL || watch('cover_image') || ""
                                                    }
                                                })()
                                            }
                                            alt="Preview"
                                            objectFit='cover'
                                            fill
                                        />

                                        <div className='absolute right-0 flex items-center px-4 rounded-lg p-2'>
                                            <Button variant='outline' shape='rounded' className='flex items-center gap-2'
                                                onClick={() => {
                                                    setSelectedImage(null)
                                                    setCoverImgURL(null)
                                                    setValue('cover_image', undefined)
                                                }}
                                            >
                                                <TrashIcon fill='red' />
                                            </Button>

                                        </div>
                                    </div>
                                }
                                {errors.cover_image && <FormError errorMessage={errors.cover_image?.message as string} className='mb-8' />}

                            </label>
                        )}
                    />


                    <Controller
                        name="tags"
                        control={control}
                        render={({ field }) => (
                            <TagInput
                                presetTags={presetArticleTags}
                                selectedTags={field.value || []}
                                onTagsChange={field.onChange}
                                className='mt-10 mb-1'
                                triggerclassName="!py-6"
                            />
                        )}
                    />



                    <Controller
                        name="content"
                        control={control}
                        defaultValue=""
                        render={({ field }) => (
                            <div className={cn('flex flex-col border-2 border-transparent rounded-lg mt-6', errors.content && 'border-red-500 my-8 ')}>
                                <ReactQuill
                                    theme="snow"
                                    value={field.value}
                                    onBlur={field.onBlur}
                                    onChange={(content, delta, source, editor) => {
                                        const previousContent = watch('content');
                                        field.onChange(content);
                                        const deletedImage = findDeletedImage(previousContent, content);

                                        if (deletedImage) {
                                            const deletedImageUrls = extractImageUrl(deletedImage);
                                            setDeletedImages([...deletedImages, ...deletedImageUrls!]);
                                        }
                                    }}
                                    modules={QuillModules}
                                    className={`w-full py-4 px-0 mt-2 rounded-lg bg-background text-black outline-none ${errors?.content && errors?.content?.message ? "showcase-input-error" : ""}`}
                                    placeholder='Write your story...'
                                    id="myQuillEditor"
                                    style={{
                                        color: theme === 'dark' ? '#fff' : '#000',
                                        border: "none",
                                    }}

                                />
                                {errors.content && <FormError errorMessage={errors.content?.message as string} className='mb-8 text-center mx-6' />}
                            </div>
                        )}
                    />
                </form>
            </div>

            <LoadingModal
                isModalOpen={isCreatingPost || isUpdatingPost}
                errorMsg={'Please wait for the post to finish uploading'}
            />
        </main>
    )
}

export default WriteNewStoryPage
