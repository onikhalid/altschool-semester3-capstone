'use client';
import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MoonIcon, SunIcon, PenIcon, Settings2, User, LogOut, Folder, SettingsIcon } from 'lucide-react';

import AllProviders from '@/utils/providers';
import { cn } from '@/lib/utils';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/utils/firebaseConfig';
import { getInitials } from '@/utils/strings';

import { Avatar, Button, ChatterLogo, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, LinkButton } from '../ui';
import { UserContext } from '@/contexts';




const Body = ({ children }: { children: React.ReactNode }) => {
  const [user, loading] = useAuthState(auth);
  const { userData } = useContext(UserContext)
  const [theme, setTheme] = useState('light');
  const params = useSearchParams();
  const pathName = usePathname();
  const postToEditId = params.get('edit');
  const router = useRouter();
  const authPathNames = ['/login', '/register', '/onboarding', '/forgot-password', '/reset-password', '/complete-profile']


  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const updatedTheme = theme === "light" ? 'dark' : 'light';
    setTheme(updatedTheme);
    localStorage.setItem("theme", updatedTheme);
  };

  const logout = () => {
    auth.signOut();
    router.push('/login')
  }



  return (
    <AllProviders>
      <div className={cn(theme === 'dark' ? 'dark' : 'light', "flex flex-col h-screen items-center justify-between font-display overflow-hidden")}>
        {
          !loading && user && !authPathNames.includes(pathName) &&
          (
            <header className="sticky top-0 flex items-center justify-between w-full px-5 py-3 md:px-10 md:py-4 border-b-[0.6px] border-muted-foreground dark:border-b-muted font-display">
              <ChatterLogo />
              <section className='flex items-center gap-4'>
                {
                  pathName === '/new' &&
                  (
                    <Button shape='rounded' className='flex items-center gap-2 rounded-lg py-1.5' type='submit' form="form">
                      {postToEditId ? "Update" : "Submit"}
                      <PenIcon color={'lightblue'} size={15} />
                    </Button>
                  )
                }
                {
                  pathName !== '/new' && (
                    <LinkButton href='/new' shape='rounded' variant='outline' className='flex items-center gap-2 rounded-lg border-muted py-1.5'>
                      Write story <PenIcon size={15} />
                    </LinkButton>
                  )
                }
                <div onClick={toggleTheme} className='cursor-pointer'>
                  {
                    theme == 'dark'
                      ?
                      <SunIcon size={24} strokeWidth={1.5} />
                      :
                      <MoonIcon size={24} strokeWidth={1.5} />
                  }
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className='ml-auto'>
                    <Avatar alt={user.displayName || "user"} src={user.photoURL || userData?.avatar} fallback={getInitials(user.displayName || "F N")} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='flex flex-col gap-1.5 px-2.5'>
                    <DropdownMenuItem className='rounded-lg'>
                      <Link href={`/u/${user?.uid}`} className='flex items-center gap-2 text-lg pr-10'>
                        <User size={20} />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className='rounded-lg'>
                      <Link href='/bookmarks' className='flex items-center gap-2 text-lg pr-10'>
                        <Folder size={20} />
                        Bookmarks
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className='rounded-lg'>
                      <Link href='/settings' className='flex items-center gap-2 text-lg pr-10'>
                        <SettingsIcon size={20} />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className=' rounded-lg'>
                      <button onClick={logout} className='flex items-center gap-2 text-lg  pr-10'>
                        <LogOut size={20} />
                        Logout
                      </button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </section>
            </header>
          )
        }
        {children}
      </div>
    </AllProviders>
  );
};

export default Body;
