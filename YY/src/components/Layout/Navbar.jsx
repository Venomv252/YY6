import { useState, useEffect } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import emailjs from '@emailjs/browser';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    experience: '',
    skills: '',
    message: ''
  });
  const studentEmail = typeof window !== 'undefined' ? localStorage.getItem('studentEmail') : null;
  const studentName = typeof window !== 'undefined' ? localStorage.getItem('studentName') : null;
  const navigate = useNavigate();
  
  // Check if we're on the home page
  const isHomePage = location.pathname === '/';
  
  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    // Event listener for opening the form from other components
    const handleOpenInternshipForm = () => {
      setIsFormOpen(true);
    };

    window.addEventListener('scroll', handleScroll);
    
    // Only add event listener if nav element exists
    const navElement = document.querySelector('nav');
    if (navElement) {
      navElement.addEventListener('openInternshipForm', handleOpenInternshipForm);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (navElement) {
        navElement.removeEventListener('openInternshipForm', handleOpenInternshipForm);
      }
    };
  }, []);

  // Define navigation links based on current location
  const navLinks = [
    { title: 'Home', href: isHomePage ? '#' : '/' },
    { title: 'Services', href: isHomePage ? '#services' : '/#services' },
    { title: 'About', href: isHomePage ? '#about' : '/#about' },
    { title: 'Blog', href: isHomePage ? '#blog' : '/#blog' },
    { title: 'Achievements', href: isHomePage ? '#achievements' : '/#achievements' },
    { title: 'Alumni', href: isHomePage ? '#alumni' : '/#alumni' },
    { title: 'Contact', href: '/contact' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // EmailJS configuration
    const serviceID = 'service_t8keicp'; // Your EmailJS Service ID
    const templateID = 'template_i2l0nqs'; // Replace with your actual EmailJS Template ID
    const userID = '9k7OVUepP2PsEsXaA'; // Replace with your actual EmailJS Public Key

    // Prepare the template parameters (form data to be sent in the email)
    const templateParams = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      education: formData.education,
      experience: formData.experience,
      skills: formData.skills,
      message: formData.message,
      to_email: 'yugayatra@gmail.com' // Add recipient email
    };

    // Send email using EmailJS
    emailjs.send(serviceID, templateID, templateParams, userID)
      .then((response) => {
        console.log('Email sent successfully:', response.status, response.text);
        // Reset form and close modal
        setFormData({
          name: '',
          email: '',
          phone: '',
          education: '',
          experience: '',
          skills: '',
          message: ''
        });
        setIsFormOpen(false);
        alert('Thank you for your application! We will contact you soon.');
      })
      .catch((error) => {
        console.error('Failed to send email:', error);
        alert('There was an error submitting your application. Please try again later.');
      });
  };

  const handleLogout = () => {
    localStorage.removeItem('studentEmail');
    localStorage.removeItem('studentName');
    localStorage.removeItem('token');
    navigate('/');
  };

  // Hide 'Apply for Internship' on all internship/test-related pages
  const hideInternshipButton = [
    '/internship-application',
    '/test-terms',
    '/payment',
    '/test',
    '/quiz'
  ].includes(location.pathname) || /^\/result\//.test(location.pathname);

  // Clear navbar for /admin routes
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <nav className="w-full bg-[#fcfaf4] border-b border-gray-200 shadow-sm fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {isAdminRoute ? (
            <>
              {/* Minimal admin navbar - just logo and logout */}
              <div className="flex items-center flex-shrink-0 mr-4">
                <Link to="/" className="flex items-center" onClick={() => window.scrollTo(0, 0)}>
                  <img
                    src="/vite.svg"
                    alt="YugaYatra Logo"
                    width="32"
                    height="32"
                    className="inline-block mr-2 transform hover:scale-105 transition-transform duration-300 object-contain"
                    style={{ clipPath: 'circle(45%)' }}
                  />
                  <span className="text-lg font-bold text-gradient align-middle">YugaYatra</span>
                </Link>
              </div>
              <div className="flex-1"></div>
              <div className="flex items-center gap-2 ml-auto">
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold text-sm hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Logo and company name - stick to the left */}
              <div className="flex items-center flex-shrink-0 mr-4">
                <Link to="/" className="flex items-center" onClick={() => window.scrollTo(0, 0)}>
                  <img
                    src="/vite.svg"
                    alt="YugaYatra Logo"
                    width="32"
                    height="32"
                    className="inline-block mr-2 transform hover:scale-105 transition-transform duration-300 object-contain"
                    style={{ clipPath: 'circle(45%)' }}
                  />
                  <span className="text-lg font-bold text-gradient align-middle">YugaYatra</span>
                </Link>
              </div>
              {/* Centered nav links */}
              <div className="flex-1 flex justify-center">
                <ul className="flex gap-4 text-base font-medium text-rich-black">
                  {navLinks.map((link, index) => (
                    link.href.startsWith('#') ? (
                      <a key={index} href={link.href} className="hover:text-lavish-gold transition-colors duration-200">{link.title}</a>
                    ) : link.href.includes('#') ? (
                      <a key={index} href={link.href} className="hover:text-lavish-gold transition-colors duration-200">{link.title}</a>
                    ) : (
                      <Link key={index} to={link.href} className="hover:text-lavish-gold transition-colors duration-200">{link.title}</Link>
                    )
                  ))}
                </ul>
              </div>
              {/* Right side buttons */}
              <div className="flex items-center gap-2 ml-auto">
                {!hideInternshipButton && (
                  <Link to="/internship-application" className="bg-gradient-to-r from-lavish-gold to-yellow-100 px-5 py-2 rounded-md font-semibold text-base shadow-sm hover:from-yellow-400 hover:to-yellow-200 transition whitespace-nowrap border border-yellow-300">Apply for Internship</Link>
                )}
                {studentEmail ? (
                  <>
                    <Link to="/profile" className="flex items-center justify-center w-10 h-10 rounded-full bg-lavish-gold text-white font-bold text-lg ml-2 hover:scale-105 transition-transform" title="Profile">
                      {studentName ? studentName.charAt(0).toUpperCase() : <span className="material-icons">person</span>}
                    </Link>
                  </>
                ) : (
                  <Link to="/signin" className="px-5 py-2 border border-lavish-gold rounded-md font-semibold text-base text-lavish-gold bg-white hover:bg-lavish-gold hover:text-white transition-colors duration-200 shadow-sm whitespace-nowrap">Sign In</Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;