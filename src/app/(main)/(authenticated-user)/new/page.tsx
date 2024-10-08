'use client'

import React, { useCallback, useContext, useEffect, useState } from 'react'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Controller, useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import 'react-quill/dist/quill.snow.css';
import { z, ZodError } from "zod";
import { v4 } from 'uuid';
import { SaveIcon, SendIcon } from 'lucide-react'
import { collection, doc, writeBatch } from 'firebase/firestore';

import { Button, FormError, LoadingModal, TagInput, Textarea } from '@/components/ui'
import { auth, db, storage } from '@/utils/firebaseConfig';
import { zodResolver } from '@hookform/resolvers/zod';
import { TrashIcon, UploadIcon, } from '@/components/icons';
import { UserContext } from '@/contexts';
import { cn } from '@/lib/utils';
import { presetArticleTags } from '@/constants';
import { convertHtmlToMarkdown, convertMarkdownToHtml } from '@/utils/quillEditor';
import MarkdownEditor from '@uiw/react-md-editor';

import { UseCreateNewPost, UseGetPostDetails, UseUpdateNewPost } from './misc/api';
import { deleteImageFromDatabase, extractImageUrls, generateTitleSearchTerms, uploadCoverImage } from './misc/utils';
import { useCreateNotification } from '../misc/api';
import { TNotification } from '../misc/types/notification';






const WriteNewStoryPage = () => {
    const params = useSearchParams()
    const router = useRouter()
    const postToEditId = params.get('edit');
    const CreateNewPostFormSchema = z.object({
        title: z.string({ message: 'Title is required' }).min(5, { message: 'Title must be at least 5 characters' }),
        content: z.string({ message: 'You cannot post an empty article' }).min(50, { message: 'Article must be at least 50 characters' }),
        tags: z.array(z.string()).min(1, { message: 'Please select at least one tag' }),
        cover_image: z.any().nullable().refine(
            file => {
                if ((!postToEditId && !file)) {
                    throw ZodError.create([{
                        path: ['cover_image'],
                        message: 'Please select a cover image.',
                        code: 'custom',
                    }]);
                }
                if ((!postToEditId && !file.type.startsWith('image/'))) {
                    throw ZodError.create([{
                        path: ['cover_image'],
                        message: 'Please select a valid image file.',
                        code: 'custom',
                    }]);
                }
                if (!postToEditId && file) {
                    return file.size <= 10000000;
                }
                else return true
            },

            {
                message: 'Max image size is 10MB.',
            }
        ),
    });
    type createNewPostFormDataType = z.infer<typeof CreateNewPostFormSchema>

    const [user, loading] = useAuthState(auth);
    const { userData, userFollowers } = useContext(UserContext);

    const { data: postData, isLoading: isFetchingPostData } = UseGetPostDetails(postToEditId)
    const { mutate: createPost, isPending: isCreatingPost } = UseCreateNewPost()
    const { mutate: updatePost, isPending: isUpdatingPost } = UseUpdateNewPost()

    const [editorMode, setEditorMode] = useState('richText');
    const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
    const MemoizedQuill = React.memo(ReactQuill);

    const {
        register, control, handleSubmit, setValue, watch, setError, clearErrors, formState: { isValid, errors }, reset
    } = useForm<createNewPostFormDataType>({
        resolver: zodResolver(CreateNewPostFormSchema),
    });


    useEffect(() => {
        if (postData) {
            setValue('title', postData.title)
            setValue('tags', postData.tags)
            setValue('content', postData.content)
            setCoverImgURL(postData.cover_image)
        }
    }, [isFetchingPostData, postData, setValue])

    const [selectedCoverImageFile, setSelectedCoverImageFile] = useState<File | null>(watch('cover_image') ?? null);
    const [coverImgURL, setCoverImgURL] = useState<string | null>(postData?.cover_image || null)
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [isSendingNotification, setIsSendingNotification] = useState(false);

    const toggleEditorMode = useCallback(async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (editorMode === 'richText') {
            const markdown = await convertHtmlToMarkdown(watch('content'));
            setValue('content', markdown);
            setEditorMode('markdown');
        } else {
            const html = await convertMarkdownToHtml(watch('content'));
            setValue('content', html);
            setEditorMode('richText');
        }
    }, [editorMode, watch, setValue]);

    const handleCreateNewPost = async (data: createNewPostFormDataType) => {
        const submittedData = data;
        const currentContent = editorMode === 'richText' ? watch('content') : await convertMarkdownToHtml(watch('content'));
        const currentImages = extractImageUrls(currentContent);
        console.log(currentContent, watch('content'))
        const deletedImages = uploadedImages.filter(
            (url) => !currentImages.includes(url)
        );

        for (const url of deletedImages) {
            await deleteImageFromDatabase(url);
        }
        const dataToSubmit = {
            ...data,
            content: editorMode === 'richText' ? watch('content') : await convertMarkdownToHtml(watch('content')),
            author_id: user?.uid || "",
            author_avatar: userData?.avatar || "",
            author_username: userData?.username || "",
            author_name: userData?.name || "",
            created_at: postData?.created_at || new Date(),
            tags_lower: data.tags.map(tag => tag.toLowerCase() || ""),
            title_for_search: [...generateTitleSearchTerms(data.title), ...(userData?.name || "").toLowerCase().split(" "), userData?.username || ""],
            cover_image: postData?.cover_image || "",
            total_reads: postData?.total_reads || 0,
            likes: postData?.likes || [],
            bookmarks: postData?.bookmarks || [],
        };

        if (postToEditId) {
            updatePost({ ...dataToSubmit, post_id: postToEditId }, {
                onSuccess: async (data) => {

                    deletedImages.filter((imageUrl) => submittedData?.content.includes(imageUrl));
                    for (const imageUrl of deletedImages) {
                        deleteImageFromDatabase(imageUrl);
                    }
                    if (selectedCoverImageFile) {
                        await uploadCoverImage({ imageFile: selectedCoverImageFile!, postId: postToEditId });
                    }
                    reset();
                    setCoverImgURL(null)
                    setSelectedCoverImageFile(null)
                    router.push(`/p/${postToEditId}`)
                },
                onError: (error) => {
                    console.error('Error updating post:', error);
                }
            });
        }

        else {
            createPost(dataToSubmit, {
                onSuccess: async (data) => {
                    const newDocId = data?.id as string || "";

                    deletedImages.filter((imageUrl) => submittedData?.content.includes(imageUrl));
                    for (const imageUrl of deletedImages) {
                        deleteImageFromDatabase(imageUrl);
                    }
                    await uploadCoverImage({ imageFile: selectedCoverImageFile!, postId: newDocId });
                    reset();
                    setSelectedCoverImageFile(null)
                    setCoverImgURL(null)
                    setIsSendingNotification(true)
                    const batch = writeBatch(db);
                    const notificationRef = collection(db, 'notifications');

                    userFollowers.forEach((followerId) => {
                        const id = v4()
                        const notificationData: TNotification = {
                            receiver_id: followerId,
                            sender_id: user?.uid || "",
                            notification_type: "NEW_POST",
                            notification_id: id,
                            read_status: false,
                            sender_details: {
                                user_id: user?.uid || "",
                                user_name: userData?.name || "",
                                user_avatar: userData?.avatar || "",
                                user_username: userData?.username || ""
                            },
                            receiver_details: {
                                user_id: followerId,
                                user_name: "",
                                user_avatar: "",
                                user_username: ""
                            },
                            notification_details: {
                                post_id: newDocId,
                                post_cover_photo: dataToSubmit.cover_image,
                                post_title: dataToSubmit.title,
                                post_author_avatar: userData?.avatar || "",
                                post_author_name: userData?.name || "",
                                post_author_username: userData?.username || ""
                            },
                            created_at: new Date()
                        }

                        const newNotificationRef = doc(notificationRef, id);
                        batch.set(newNotificationRef, notificationData);
                    });

                    await batch.commit();
                    router.push(`/p/${newDocId}`)
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
            const storageRef = ref(storage, `post_images/${user?.uid}/${file.name}_${new Date().toString()}`);

            try {
                const snapshot = await uploadBytes(storageRef, file, {
                    contentType: file.type,
                    customMetadata: {},
                });

                const downloadURL = await getDownloadURL(snapshot.ref);
                setUploadedImages((prev) => [...prev, downloadURL]);
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




    const handleCoverImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files![0];
        setSelectedCoverImageFile(file);
        const newImgURL = URL.createObjectURL(file)
        setCoverImgURL(newImgURL)
    };



    if (isFetchingPostData) {
        return (<LoadingModal
            isModalOpen={isFetchingPostData}
            errorMsg='Please wait while we fetch the post data'
        />)
    }








    return (
        <main className="relative grow flex items-start justify-center w-full px-4 lg:px-[7.5vw] lg:gap-[5vw] max-h-[calc(100vh_-_4.5rem)] pt-8 overflow-scroll">
            <form onSubmit={handleSubmit(handleCreateNewPost)} className=' w-full max-w-[1000px]' id='form'>

                <Textarea
                    className='!border-none font-display text-4xl xl:text-5xl mb-4 font-bold focus:border-none focus-visible:border-none text-center'
                    {...register('title')}
                    placeholder='Enter Title'
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
                                        handleCoverImageSelect(e);
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
                                (selectedCoverImageFile || coverImgURL || watch('cover_image')) &&
                                <div className='relative w-full aspect-video'>
                                    <Image
                                        className=''
                                        src={
                                            (() => {
                                                if (postData?.cover_image && !selectedCoverImageFile && !coverImgURL) {
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
                                                setSelectedCoverImageFile(null)
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
                            hasError={!!errors.tags}
                            errorMessage={errors.tags?.message}
                        />
                    )}
                />

                <Button onClick={(e) => toggleEditorMode(e)} className='text-xs mt-6 h-5' >
                    Switch to {editorMode === 'richText' ? 'Markdown' : 'Rich Text'} Editor
                </Button>

                <Controller
                    name="content"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                        <div className={' pb-8'}>
                            {
                                editorMode === 'markdown' ?
                                    <MarkdownEditor
                                        value={field.value}
                                        onChange={(content) => field.onChange(content)}
                                        className={`w-full py-4 px-0 mt-2 rounded-lg bg-background outline-none min-h-[400px]`}
                                        style={{ border: "none" }}
                                    />
                                    :
                                    <MemoizedQuill
                                        theme="snow"
                                        value={field?.value?.replace("<p><br></p>", "") || ''}
                                        onBlur={field.onBlur}
                                        onChange={(content, editor) => { field.onChange(content); }}
                                        modules={{
                                            toolbar: {
                                                container: [
                                                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

                                                    ['bold', 'italic', 'underline', 'strike'],
                                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                    [{ 'indent': '-1' }, { 'indent': '+1' }],
                                                    [{ 'align': [] }],

                                                    ['link', 'image'],
                                                    ['clean']
                                                ],
                                                handlers: {
                                                    image: QuillimageSelectionHandler
                                                }
                                            },
                                            clipboard: {
                                                matchVisual: false,
                                            },
                                        }}

                                        className={`w-full py-4 px-0 mt-2 rounded-lg bg-background outline-none`}
                                        placeholder='Start writing...'
                                        style={{ border: "none" }}
                                        id="myQuillEditor"
                                    />
                            }
                        </div>
                    )}
                />
                <Button shape='rounded' variant="default" className='flex items-center gap-2 rounded-lg py-1.5 w-full my-8' type='submit' form="form">
                    <span className=''>
                        {postToEditId ? "Update" : "Submit"}
                    </span>
                    {
                        postToEditId ?
                            <SaveIcon size={15} />
                            :
                            <SendIcon size={15} />
                    }
                </Button>
            </form>


            <LoadingModal
                isModalOpen={isCreatingPost || isUpdatingPost || isSendingNotification}
                errorMsg={'Please wait for the post to finish uploading'}
            />
        </main>
    )
}

export default WriteNewStoryPage
