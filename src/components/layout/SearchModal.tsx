import {  Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '../ui'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface Props {
    isModalOpen: boolean
    closeModal: () => void
}
const SearchModal: React.FC<Props> = ({ isModalOpen, closeModal }) => {

    const router = useRouter()
    const [searchText, setSearchText] = useState("")
    const [hasErrors, setHasErrors] = useState(false)
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    useEffect(() => {
        if (inputRef?.current) {
            inputRef.current.focus()
        }
    }, [])

    const handleInputChange = (newValue: string) => {
        setSearchText(newValue)
        if (newValue.length > 0) {
            setHasErrors(false)
        }
    }

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (searchText.length < 3) {
            setHasErrors(true)
            return
        }
        router.push(`/search/posts?q=${searchText}`)
        closeModal()
    }


    return (
        <Dialog open={isModalOpen} onOpenChange={closeModal}>
            <DialogContent className='p-6'>
                <DialogHeader>
                    <DialogTitle>Search Chattter</DialogTitle>
                </DialogHeader>

                <form className='w-full min-w-[300px] max-w-lg' onSubmit={(e) => handleSearch(e)}>
                    <h1 className='font-display text-6xl font-medium'>
                        Search
                    </h1>
                    <Input
                        ref={inputRef}
                        name="search-input"
                        className='w-full mt-4'
                        placeholder='Search for posts, users, tags, etc...'
                        value={searchText}
                        onChange={(e) => handleInputChange(e.target.value)}
                        type='search'
                        hasError={hasErrors}
                        errorMessage={searchText.length == 0 ? 'Please enter a search term' : 'Please enter at least 3 characters'}
                    />
                </form>

                <footer className='flex items-center justify-center gap-2'>

                </footer>
            </DialogContent>

        </Dialog>
    )
}

export default SearchModal