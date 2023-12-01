(async () => {
    const {writeFileSync, readFileSync} = require('fs');
    require('dotenv').config();
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true});
    const page = await browser.newPage();
    const axios = require('axios');

    let noticesTypes = await axios.get(process.env.BASE_URL + '/api/notices/types').then(result => result.data.noticeType)

    let malcomJson = [];

    console.log("Found " + Object.keys(noticesTypes).length + " notices")

    var courts = await axios.get(process.env.BASE_URL + '/api/courts').then(result => result.data);

    var courtIds = [];
    var courtValues = [];

    courts.forEach(obj => {
        courtIds.push(obj.id);
        courtValues.push(obj.id);
    });

    for (let notice of Object.values(noticesTypes)) {
        let url = process.env.BASE_URL
            + process.env.BASE_QUERY_PATH
            + '/'
            + notice.slug;

        console.log("going to " + url);

        let response = await page.goto(url);

        if ([500, 404, 403].includes(response.status())) {
            continue;
        }

        await page.waitForSelector("#form_notice");

        let noticeForm = await page.evaluate(async ({courtIds, courtValues}) => {
            let parent = document.getElementById("form_notice");

            let allChildNodes = parent.querySelectorAll('.form-control')

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

                if (child?.type === 'hidden') {
                    continue;
                }

                formElements.push(child);
            }

            let finalFormElements = [];

            function getType(el) {
                let type;

                if (el.classList.contains('datepicker')) {
                    return 'date';
                }

                let tagName = el.tagName.toLowerCase();

                switch (tagName) {
                    case 'textarea':
                        type = 'textarea';
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

                let options;
                let values;

                if (el.id === 'field_company_court_id') {
                    options = courtValues;
                    values = courtIds;
                } else {
                    options = [...el.options].map(o => o.text);
                    values = [...el.options].map(o => o.value);
                }

                return {
                    values,
                    options,
                    style: {
                        "min_width": "100%"
                    },
                    radio: false,
                    multiple: el.multiple,
                }
            }

            function uuidv4() {
                return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
            }

            let excludedIds = [
                'field_principal_header_title',
                'field_principal_header_subtitle',
            ];

            for (let i = 0; i < formElements.length; i++) {
                let child = formElements[i];

                if (excludedIds.includes(child.id)) {
                    continue;
                }

                let forceLabel;

                if (child.name.endsWith('_other]')) {
                    forceLabel = 'Préciser';
                }

                let label = document.querySelector('label[for=' + child.id + ']');

                let uuid = uuidv4();

                let needToBeFix = false;

                function capitalizeFirstLetter(string) {
                    return string.charAt(0).toUpperCase() + string.slice(1);
                }

                let name = (forceLabel || label?.innerText.replace(' :', '') || child.placeholder || uuid);

                if (name === 'SIRET et RCS') {
                    name = 'SIRET';
                }

                if (name === uuid) {
                    if (child.id === 'field_company_court_id') {
                        name = 'RCS';
                    } else if (child.id === 'meta_notice_new_organ_role') {
                        name = 'Organe de direction';
                    } else if (child.id === 'meta_notice_type') {
                        name = "Type d'avis";
                    } else {
                        needToBeFix = true;
                    }
                } else {
                    name = capitalizeFirstLetter(name);
                }

                finalFormElements.push({
                    id: uuidv4(),
                    name,
                    type: getType(child),
                    domId: child.id,
                    domName: child.name,
                    required: child.required,
                    ...buildSelect(child),
                    size: 24,
                    labelElement: label?.outerHTML,
                    inputElement: child?.outerHTML,
                    defaultValue: child.value,
                    placeholder: child.placeholder,
                    needToBeFix,
                });
            }

            return finalFormElements;
        }, {courtIds, courtValues});

        malcomJson.push({
            form: noticeForm,
            notice,
        });
    }

    writeFileSync(
        './malcom.json',
        JSON.stringify(malcomJson, null, 2)
    );

    await browser.close();

    return malcomJson;
})()
