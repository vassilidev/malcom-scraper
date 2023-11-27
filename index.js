(async () => {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.goto('http://localhost:81/journaux/tribune-de-lyon/editions/07-12-2023/annonces/saisie/constitution-societe-commerciale');

    await page.waitForNetworkIdle();

    await page.evaluate(async () => {
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        let allChildNodes;

        // function parseChildNode(parent) {
        //     for (let i = 0; i < parent.childNodes.length; i++) {
        //         const child = parent.childNodes[i];
        //
        //         if (child.hasChildNodes()) {
        //             if (window.getComputedStyle(child).display === 'none') {
        //                 continue;
        //             }
        //
        //             parseChildNode(child);
        //         } else {
        //             allChildNodes.push(child)
        //         }
        //     }
        // }

        let parent = document.getElementById("form_notice");

        // parseChildNode(parent);

        allChildNodes = parent.querySelectorAll('.form-control')

        let formElements = [];
        let tagNames = ['input', 'textarea', 'select'];

        for (let i = 0; i < allChildNodes.length; i++) {
            const child = allChildNodes[i];

            if (child.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }

            let tagName = child.tagName.toLowerCase();

            if (!tagNames.includes(tagName)) {
                continue;
            }

            if (child?.type === 'hidden') { //|| window.getComputedStyle(child).display === 'none') {
                continue;
            }

            formElements.push(child);
        }

        console.log(formElements)

        let finalFormElements = [];

        function getType(el) {
            let type;

            if (el.classList.contains('datepicker')) {
                return 'date';
            }

            let tagName = el.tagName.toLowerCase();

            switch (tagName) {
                case 'textarea':
                    type = 'input';
                    break
                case 'select':
                    type = 'select_multiple';
                    break;
                default:
                    type = tagName
            }

            return type;
        }

        function buildSelect(el) {
            if (el.tagName.toLowerCase() !== 'select') {
                return;
            }
            
            return {
                values: [...el.options].map(o => o.value),
                options: [...el.options].map(o => o.text),
                style: {
                    "min_width": "100%"
                },
                radio: false,
                multiple: el.multiple,
            }
        }

        for (let i = 0; i < formElements.length; i++) {
            let child = formElements[i];

            finalFormElements.push({
                id: (new Date()).getTime(),
                name: document.querySelector('label[for=' + child.id + ']')?.innerText.replace(' :', '') || child.placeholder,
                type: getType(child),
                required: child.required,
                size: 24,
                ...buildSelect(child),
            });

            await sleep(100);
        }

        console.log(JSON.stringify(finalFormElements));
    });
})()