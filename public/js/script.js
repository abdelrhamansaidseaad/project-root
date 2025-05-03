// وظائف مساعدة
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'result-message error';
    errorElement.textContent = message;
    return errorElement;
}

function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'result-message success';
    successElement.textContent = message;
    return successElement;
}

function getToken() {
    return localStorage.getItem('token');
}

function redirectIfNotLoggedIn() {
    if (!getToken() && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('employeeId');
    localStorage.removeItem('employeeName');
    window.location.href = '/login';
}

// تسجيل الدخول
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'فشل تسجيل الدخول');
            }
            
            localStorage.setItem('token', data.token);
            localStorage.setItem('employeeId', data.employeeId);
            localStorage.setItem('employeeName', data.name);
            
            window.location.href = '/dashboard';
        } catch (error) {
            const resultDiv = document.getElementById('loginResult') || document.createElement('div');
            resultDiv.id = 'loginResult';
            resultDiv.innerHTML = '';
            resultDiv.appendChild(showError(error.message));
            
            if (!document.getElementById('loginResult')) {
                document.getElementById('loginForm').appendChild(resultDiv);
            }
        }
    });
}

// تسجيل موظف جديد
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const employeeId = document.getElementById('employeeId').value;
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('كلمات المرور غير متطابقة');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ employeeId, name, email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'فشل التسجيل');
            }
            
            alert('تم تسجيل الموظف بنجاح! يمكنك الآن تسجيل الدخول');
            window.location.href = '/login';
        } catch (error) {
            const resultDiv = document.getElementById('registerResult') || document.createElement('div');
            resultDiv.id = 'registerResult';
            resultDiv.innerHTML = '';
            resultDiv.appendChild(showError(error.message));
            
            if (!document.getElementById('registerResult')) {
                document.getElementById('registerForm').appendChild(resultDiv);
            }
        }
    });
}

// لوحة التحكم
if (document.getElementById('employeeName')) {
    redirectIfNotLoggedIn();
    
    document.getElementById('employeeName').textContent = localStorage.getItem('employeeName') || 'موظف';
    document.getElementById('employeeId').textContent = localStorage.getItem('employeeId') || 'غير معروف';
    
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    }
    
    // جلب البطاقات
    async function fetchCards() {
        try {
            const response = await fetch('/api/cards', {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'فشل جلب البطاقات');
            }
            
            const cardsList = document.getElementById('cardsList');
            cardsList.innerHTML = '';
            
            if (data.length === 0) {
                cardsList.appendChild(showError('لا توجد بطاقات متاحة'));
            } else {
                data.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'card';
                    cardElement.innerHTML = `
                        <h4>${card.holderName}</h4>
                        <p>رقم البطاقة: ${card.cardNumber}</p>
                        <p>الرصيد: ${card.balance.toFixed(2)}</p>
                    `;
                    cardsList.appendChild(cardElement);
                });
            }
        } catch (error) {
            console.error('Error fetching cards:', error);
        }
    }
    
    fetchCards();
}

// إضافة بطاقة جديدة
if (document.getElementById('addCardForm')) {
    redirectIfNotLoggedIn();
    
    document.getElementById('addCardForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cardNumber = document.getElementById('cardNumber').value;
        const holderName = document.getElementById('holderName').value;
        const initialBalance = document.getElementById('initialBalance').value;
        
        try {
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ 
                    cardNumber, 
                    holderName, 
                    initialBalance: initialBalance ? parseFloat(initialBalance) : 0 
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'فشل إضافة البطاقة');
            }
            
            const resultDiv = document.getElementById('addCardResult') || document.createElement('div');
            resultDiv.id = 'addCardResult';
            resultDiv.innerHTML = '';
            resultDiv.appendChild(showSuccess('تمت إضافة البطاقة بنجاح'));
            
            if (!document.getElementById('addCardResult')) {
                document.getElementById('addCardForm').appendChild(resultDiv);
            }
            
            // مسح النموذج
            document.getElementById('addCardForm').reset();
        } catch (error) {
            const resultDiv = document.getElementById('addCardResult') || document.createElement('div');
            resultDiv.id = 'addCardResult';
            resultDiv.innerHTML = '';
            resultDiv.appendChild(showError(error.message));
            
            if (!document.getElementById('addCardResult')) {
                document.getElementById('addCardForm').appendChild(resultDiv);
            }
        }
    });
}

// سحب من البطاقة
if (document.getElementById('withdrawForm')) {
    redirectIfNotLoggedIn();
    
    document.getElementById('withdrawForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cardNumber = document.getElementById('cardNumber').value;
        const amount = document.getElementById('amount').value;
        const branchId = document.getElementById('branchId').value;
        
        try {
            const response = await fetch('/api/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ 
                    cardNumber, 
                    amount: parseFloat(amount), 
                    branchId 
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'فشل عملية السحب');
            }
            
            const resultDiv = document.getElementById('withdrawResult');
            resultDiv.innerHTML = '';
            resultDiv.appendChild(showSuccess(`تم السحب بنجاح. الرصيد الجديد: ${data.newBalance.toFixed(2)}`));
            
            // مسح النموذج
            document.getElementById('withdrawForm').reset();
        } catch (error) {
            const resultDiv = document.getElementById('withdrawResult');
            resultDiv.innerHTML = '';
            resultDiv.appendChild(showError(error.message));
        }
    });
}

// عرض الموظفين
if (document.getElementById('employeesList')) {
    redirectIfNotLoggedIn();
    
    async function fetchEmployees() {
        try {
            // في نظام حقيقي، سنحتاج إلى نقطة نهاية لجلب جميع الموظفين
            // هنا سنجلب فقط الموظف الحالي كمثال
            const employeeId = localStorage.getItem('employeeId');
            const response = await fetch(`/api/employees/${employeeId}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'فشل جلب بيانات الموظفين');
            }
            
            const employeesList = document.getElementById('employeesList');
            employeesList.innerHTML = '';
            
            const employeeElement = document.createElement('div');
            employeeElement.className = 'employee-card';
            employeeElement.innerHTML = `
                <h3>${data.name}</h3>
                <p>رقم الموظف: ${data.employeeId}</p>
                <p>البريد الإلكتروني: ${data.email}</p>
                <p>الصلاحيات: ${data.permissions.join(', ')}</p>
            `;
            employeesList.appendChild(employeeElement);
        } catch (error) {
            console.error('Error fetching employees:', error);
            const employeesList = document.getElementById('employeesList');
            employeesList.innerHTML = '';
            employeesList.appendChild(showError('فشل جلب بيانات الموظفين'));
        }
    }
    
    fetchEmployees();
}

// التحقق من حالة تسجيل الدخول عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        redirectIfNotLoggedIn();
    }
});