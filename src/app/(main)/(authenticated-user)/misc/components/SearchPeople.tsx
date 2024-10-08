'use client';
import React, { useContext, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';
import { TUser } from '@/contexts';
import { LinkButton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';

import PostCard from './PostCard';
import PostCardSkeleton from './PostCardSkeleton';
import { useUsersBySearchInfiniteQuery } from '../api';
import { UsersQueryResult } from '../api/getUserBySearch';
import UserCard from './UserCard';
import { File, User } from 'lucide-react';

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'likes_desc' | 'likes_asc';

const SearchPeople = () => {
    const [sortBy, setSortBy] = useState<SortOption>('date_desc');
    const searchParams = useSearchParams();
    const search_text = searchParams.get('q') || '';

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        status,
        error,
        refetch
    } = useUsersBySearchInfiniteQuery(decodeURI(search_text), sortBy);

    const { ref, inView } = useInView();
    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleSortChange = (value: string) => {
        setSortBy(value as SortOption);
        refetch();
    };





    return (
        <section className='grow relative flex flex-col w-full max-w-[550px] lg:max-w-[1200px] mx-auto'>
            <div className={cn('flex items-center border-b-[1.5px] w-full border-muted-foreground dark:border-muted py-4',
                data?.pages.reduce((total, page) => total + page.users.length, 0) == 0 && "hidden")}
            >
                <Select onValueChange={handleSortChange} defaultValue={sortBy}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date_desc">Joined First</SelectItem>
                        <SelectItem value="date_asc">Latest Member</SelectItem>
                        <SelectItem value="name_asc">Name A-Z</SelectItem>
                        <SelectItem value="name_desc">Name Z-A</SelectItem>
                    </SelectContent>
                </Select>
            </div>


            <div className='flex flex-col divide-y-[1.5px] w-full divide-muted-foreground dark:divide-muted'>
                {
                    isLoading && Array.from({ length: 10 }).map((_, i) => (
                        <PostCardSkeleton key={i} />
                    ))
                }
            </div>


            {
                search_text.trim() !== "" && data?.pages.reduce((total, page) => total + page.users.length, 0) == 0 && !isLoading && (
                    <div className='flex flex-col items-center justify-center w-full my-auto'>
                        <article className='bg-background p-6 lg:p-10 rounded-3xl max-md:rounded-b-none mx-auto w-full max-w-[525px]'>
                            <h3 className='text-5xl font-medium'>No user found.</h3>
                            <p className='my-5'>
                                We couldn&apos;t find any user with this name or username &quot;{search_text}&quot; on Chattter, try again later or change your search text.
                            </p>
                        </article>
                    </div>
                )
            }

            {
                search_text.trim() == "" && !isLoading && (
                    <div className='flex flex-col items-center justify-center w-full my-auto'>
                        <article className='bg-background p-6 lg:p-10 rounded-3xl max-md:rounded-b-none mx-auto w-full max-w-[525px]'>
                            <User />
                            <h3 className='text-5xl font-medium'>Search users on Chatter.</h3>
                            <p className='my-5'>
                                Search for a name or username of a user on Chattter.
                            </p>
                        </article>
                    </div>
                )
            }





            {
                data?.pages.map((page: UsersQueryResult, i: number) => (
                    <div key={i} className='flex flex-col divide-y-[1.5px] w-full divide-muted-foreground dark:divide-muted'>
                        {
                            page.users.map((user: TUser) => (
                                <UserCard key={user.uid} user={user} />
                            ))
                        }
                    </div>
                ))}

            <div ref={ref} className={cn('w-full', search_text.trim() == "" && "hidden")}>
                {
                    isFetchingNextPage
                        ?
                        <div className='flex flex-col divide-y-[1.5px] w-full divide-muted-foreground dark:divide-muted'>
                            {
                                Array.from({ length: 4 }).map((_, i) => (
                                    <PostCardSkeleton key={i} />
                                ))
                            }
                        </div>

                        :
                        hasNextPage
                            ?
                            <div className="h-2" />
                            :
                            <div className={cn('mt-4 py-5 w-full text-center', data?.pages.reduce((total, page) => total + page.users.length, 0) == 0 && "hidden")}>
                                - End -
                            </div>
                }
            </div>
        </section>
    )
}

export default SearchPeople