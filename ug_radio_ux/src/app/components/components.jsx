'use client'
export function NavBar(){
    return (
            <nav className='fixed bottom-5 left-0 w-full text-white'>
            <ul className='flex justify-around gap-4 '>
                <li><a href='/library'>LIBRARY</a></li>
                <li><a href='/home'>HOME</a></li>
                <li><a>ACCOUNT</a></li>
            </ul>
            </nav>
    )
}