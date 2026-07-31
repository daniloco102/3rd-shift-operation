
                                function calcHrTotal() {
                                    const deps = ['inout3', 'inout5', 'sort3'];
                                    deps.forEach(dep => {
                                        const ns = Number(document.getElementById(`ops-hr-${dep}-ns`).value) || 0;
                                        const gc = Number(document.getElementById(`ops-hr-${dep}-gc`).value) || 0;
                                        document.getElementById(`ops-hr-${dep}-total`).innerText = ns + gc;
                                    });
                                }

                                function calcOpsKPI() {
                                    // Hàm tính KPI đã được bỏ, người dùng sẽ tự nhập
                                }
                            